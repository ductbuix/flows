import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createEngine } from "./engine.ts"
import { EventLog } from "./event-log.ts"
import { appDbPath } from "./paths.ts"
import { portLeases } from "./port-lease.ts"
import { canApplySandbox } from "./sandbox.ts"

const homes: string[] = []
const engines: Array<{ close: () => void }> = []

afterEach(() => {
  portLeases.reset()
  for (const engine of engines.splice(0)) {
    engine.close()
  }
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-ports-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, id: string, body: string): string {
  const wf = join(home, "workflows", id)
  mkdirSync(wf, { recursive: true })
  writeFileSync(join(wf, "workflow.yaml"), body)
  return wf
}

describe("port leases and workflow caches", () => {
  it("gives parallel attempts disjoint port blocks and releases on finish", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "ports-parallel",
      [
        "id: ports-parallel",
        "limits:",
        "  concurrency: 2",
        "tasks:",
        "  - id: a",
        "    kind: command",
        '    run: "printf \'%s\' \\"$FLOWS_PORT_BASE\\" > \\"$TASK_OUT/port.txt\\"; sleep 0.4"',
        "  - id: b",
        "    kind: command",
        '    run: "printf \'%s\' \\"$FLOWS_PORT_BASE\\" > \\"$TASK_OUT/port.txt\\"; sleep 0.4"',
        "",
      ].join("\n")
    )

    const engine = createEngine({ home })
    engines.push(engine)
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()

    expect(state.status).toBe("succeeded")
    const events = engine
      .events("r1")
      .filter((e) => e.type === "attempt_launched")
    expect(events).toHaveLength(2)
    const bases = events.map((e) => {
      expect(e.type).toBe("attempt_launched")
      if (e.type !== "attempt_launched") throw new Error("unreachable")
      expect(e.portBase).toBeTypeOf("number")
      expect(e.portCount).toBe(10)
      return e.portBase!
    })
    expect(new Set(bases).size).toBe(2)

    const outA = readFileSync(
      join(wf, "runs", "r1", "tasks", "a", "latest", "out", "port.txt"),
      "utf8"
    )
    const outB = readFileSync(
      join(wf, "runs", "r1", "tasks", "b", "latest", "out", "port.txt"),
      "utf8"
    )
    expect(outA).not.toBe(outB)
    expect(portLeases.heldBases()).toEqual([])
  })

  it("sets package cache env under .cache and allows sandboxed pnpm install", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "cache-pnpm",
      [
        "id: cache-pnpm",
        "tasks:",
        "  - id: install",
        "    kind: command",
        `    run: 'cd "$WF_DIR/pkg" && HOME="$WF_DIR/.cache/home" pnpm install && printf ok > "$TASK_OUT/done.txt" && test -d "$PNPM_STORE_DIR" && test -d "$npm_config_cache"'`,
        "",
      ].join("\n")
    )
    mkdirSync(join(wf, "pkg"), { recursive: true })
    mkdirSync(join(wf, ".cache", "home"), { recursive: true })
    writeFileSync(
      join(wf, "pkg", "package.json"),
      JSON.stringify({ name: "t", version: "1.0.0", private: true })
    )
    writeFileSync(
      join(wf, "pkg", ".npmrc"),
      "ignore-workspace-root-check=true\n"
    )

    const engine = createEngine({ home })
    engines.push(engine)
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()

    expect(state.status).toBe("succeeded")
    expect(
      readFileSync(
        join(wf, "runs", "r1", "tasks", "install", "latest", "out", "done.txt"),
        "utf8"
      )
    ).toBe("ok")
    expect(existsSync(join(wf, ".cache", "pnpm"))).toBe(true)
    expect(existsSync(join(wf, ".cache", "npm"))).toBe(true)

    if (canApplySandbox()) {
      const launched = engine
        .events("r1")
        .find((e) => e.type === "attempt_launched")
      expect(launched && launched.type === "attempt_launched").toBe(true)
      if (launched?.type === "attempt_launched") {
        expect(launched.sandboxed).toBe(true)
      }
      expect(state.sandboxed).toBe(true)
    }
  })

  it("releases port leases when resume finds a dead attempt", async () => {
    const home = tempHome()
    writeWorkflow(
      home,
      "ports-resume",
      [
        "id: ports-resume",
        "tasks:",
        "  - id: a",
        "    kind: command",
        '    run: "true"',
        "",
      ].join("\n")
    )
    mkdirSync(
      join(
        home,
        "workflows",
        "ports-resume",
        "runs",
        "r-dead",
        "tasks",
        "a",
        "attempt-1"
      ),
      {
        recursive: true,
      }
    )

    const log = new EventLog(appDbPath(home))
    const graph = {
      id: "ports-resume",
      tasks: [
        {
          id: "a",
          kind: "command" as const,
          run: "true",
          needs: [] as string[],
        },
      ],
    }
    log.append({
      type: "run_started",
      runId: "r-dead",
      workflowId: "ports-resume",
      graph,
      at: "t0",
    })
    log.append({
      type: "attempt_started",
      runId: "r-dead",
      taskId: "a",
      attempt: 1,
      at: "t1",
    })
    log.append({
      type: "attempt_launched",
      runId: "r-dead",
      taskId: "a",
      attempt: 1,
      pid: 2_147_483_647,
      sandboxed: true,
      portBase: 23_010,
      portCount: 10,
      at: "t2",
    })
    log.close()

    portLeases.rehold("r-dead:a:1", { base: 23_010, count: 10 })
    expect(portLeases.heldBases()).toEqual([23_010])

    const engine = createEngine({ home })
    engines.push(engine)
    const handle = engine.resumeRun("r-dead")
    expect(handle).not.toBeNull()
    await handle!.wait()
    expect(
      engine.events("r-dead").some((e) => e.type === "attempt_interrupted")
    ).toBe(true)
    expect(portLeases.heldBases()).toEqual([])
  })
})

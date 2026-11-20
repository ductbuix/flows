import { spawn } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { createEngine } from "./engine.ts"
import { EventLog } from "./event-log.ts"
import { appDbPath } from "./paths.ts"

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const tsxCli = require.resolve("tsx/cli", {
  paths: [join(here, "../../../apps/server")],
})

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-resume-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, id: string, yaml: string): string {
  const workflowDir = join(home, "workflows", id)
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), yaml)
  return workflowDir
}

function waitForFile(path: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (existsSync(path)) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`timed out waiting for ${path}`))
        return
      }
      setTimeout(tick, 50)
    }
    tick()
  })
}

describe("resume after restart", () => {
  it("re-attaches a live pid after the engine process is killed", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "resume-live",
      `
id: resume-live
tasks:
  - id: a
    kind: command
    run: "printf done > \\"$WF_DIR/a-done.txt\\""
  - id: b
    kind: command
    run: "sleep 8 && printf ok > \\"$TASK_OUT/out.txt\\""
    needs: [a]
`
    )
    const marker = join(workflowDir, "a-done.txt")

    const harness = join(here, "resume-harness.ts")
    // Detached process group so SIGKILL to -pid stops tsx and the harness
    // without killing the workflow task processes (those are their own groups).
    const child = spawn(
      process.execPath,
      [tsxCli, harness, home, workflowDir, "run-live"],
      { stdio: ["ignore", "pipe", "pipe"], detached: true }
    )
    if (child.pid === undefined) throw new Error("harness failed to start")

    await waitForFile(marker)
    await waitForFile(
      join(workflowDir, "runs", "run-live", "tasks", "b", "attempt-1", "out")
    )

    process.kill(-child.pid, "SIGKILL")
    await new Promise<void>((resolve) => child.once("exit", () => resolve()))

    const engine = createEngine({ home })
    const before = engine.fold("run-live")
    expect(before?.status).toBe("running")
    expect(before?.tasks.a?.status).toBe("succeeded")
    expect(before?.tasks.b?.status).toBe("running")

    const handles = engine.resumeAll()
    expect(handles.map((h) => h.runId)).toEqual(["run-live"])
    const state = await handles[0]!.wait()

    expect(state.status).toBe("succeeded")
    expect(state.tasks.a?.status).toBe("succeeded")
    expect(state.tasks.b?.status).toBe("succeeded")
    expect(state.tasks.a?.attempts).toHaveLength(1)
    expect(state.tasks.b?.attempts).toHaveLength(1)

    const out = readFileSync(
      join(
        workflowDir,
        "runs",
        "run-live",
        "tasks",
        "b",
        "latest",
        "out",
        "out.txt"
      ),
      "utf8"
    )
    expect(out).toBe("ok")
    engine.close()
  }, 40_000)

  it("records interrupted when the pid is gone and exit.code is missing", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "resume-dead",
      `
id: resume-dead
tasks:
  - id: a
    kind: command
    run: "printf a > \\"$TASK_OUT/out.txt\\""
`
    )

    // Seed a running attempt with a dead pid and no exit.code.
    mkdirSync(
      join(workflowDir, "runs", "run-dead", "tasks", "a", "attempt-1"),
      {
        recursive: true,
      }
    )
    const log = new EventLog(appDbPath(home))
    const graph = {
      id: "resume-dead",
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
      runId: "run-dead",
      workflowId: "resume-dead",
      graph,
      at: "t0",
    })
    log.append({
      type: "attempt_started",
      runId: "run-dead",
      taskId: "a",
      attempt: 1,
      at: "t1",
    })
    log.append({
      type: "attempt_launched",
      runId: "run-dead",
      taskId: "a",
      attempt: 1,
      pid: 2_147_483_647,
      at: "t2",
    })
    log.close()

    const engine = createEngine({ home })
    const handle = engine.resumeRun("run-dead")
    expect(handle).not.toBeNull()
    const state = await handle!.wait()

    expect(state.status).toBe("failed")
    expect(state.tasks.a?.status).toBe("failed")
    expect(state.tasks.a?.attempts[0]?.interrupted).toBe(true)
    expect(
      engine.events("run-dead").some((e) => e.type === "attempt_interrupted")
    ).toBe(true)
    engine.close()
  }, 15_000)

  it("finishes from exit.code when the process died after writing it", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "resume-exit",
      `
id: resume-exit
tasks:
  - id: a
    kind: command
    run: "true"
  - id: b
    kind: command
    run: "printf b > \\"$TASK_OUT/out.txt\\""
    needs: [a]
`
    )

    const attemptRoot = join(
      workflowDir,
      "runs",
      "run-exit",
      "tasks",
      "a",
      "attempt-1"
    )
    mkdirSync(join(attemptRoot, "out"), { recursive: true })
    writeFileSync(join(attemptRoot, "exit.code"), "0")
    symlinkSync(
      "attempt-1",
      join(workflowDir, "runs", "run-exit", "tasks", "a", "latest")
    )

    const log = new EventLog(appDbPath(home))
    const graph = {
      id: "resume-exit",
      tasks: [
        {
          id: "a",
          kind: "command" as const,
          run: "true",
          needs: [] as string[],
        },
        {
          id: "b",
          kind: "command" as const,
          run: 'printf b > "$TASK_OUT/out.txt"',
          needs: ["a"],
        },
      ],
    }
    log.append({
      type: "run_started",
      runId: "run-exit",
      workflowId: "resume-exit",
      graph,
      at: "t0",
    })
    log.append({
      type: "attempt_started",
      runId: "run-exit",
      taskId: "a",
      attempt: 1,
      at: "t1",
    })
    log.append({
      type: "attempt_launched",
      runId: "run-exit",
      taskId: "a",
      attempt: 1,
      pid: 2_147_483_647,
      at: "t2",
    })
    log.close()

    const engine = createEngine({ home })
    const handle = engine.resumeRun("run-exit")
    const state = await handle!.wait()

    expect(state.status).toBe("succeeded")
    expect(state.tasks.a?.attempts).toHaveLength(1)
    expect(state.tasks.a?.status).toBe("succeeded")
    expect(state.tasks.b?.status).toBe("succeeded")
    engine.close()
  }, 20_000)
})

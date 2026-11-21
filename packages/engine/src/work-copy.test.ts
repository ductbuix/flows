import { execFileSync } from "node:child_process"
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
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { parseWorkflowYaml } from "@workspace/shared"
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "./connectors/index.ts"
import { createConnection } from "./connections.ts"
import { createEngine } from "./engine.ts"
import { serialLocks } from "./serial-lock.ts"
import {
  copyPinnedEntity,
  diffWorkCopy,
  ensureLibraryGcAutoOff,
  workEntityDir,
} from "./work-copy.ts"

const homes: string[] = []

beforeEach(() => {
  registerConnector(fakeConnector)
  serialLocks.reset()
})

afterEach(() => {
  clearConnectors()
  serialLocks.reset()
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-work-"))
  homes.push(home)
  return home
}

function writeConn(
  home: string,
  id: string,
  scope: Record<string, string>,
  opts?: { serial?: boolean }
) {
  const result = createConnection(home, {
    id,
    connector: "fake",
    name: id,
    scope,
    signIn: "cli",
    refresh: "1h",
    ...(opts?.serial ? { serial: true } : {}),
  })
  expect(result.ok).toBe(true)
  return result.ok ? result.value : null
}

function writeWorkflow(home: string, id: string, body: string): string {
  const wf = join(home, "workflows", id)
  mkdirSync(wf, { recursive: true })
  writeFileSync(join(wf, "workflow.yaml"), body)
  return wf
}

describe("work copies", () => {
  it("creates a shared copy on first propose and reuses it", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const wf = writeWorkflow(
      home,
      "propose-reuse",
      `
id: propose-reuse
tasks:
  - id: a
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "echo changed > \\"$RESOURCE_DEMO/item/v1/data.txt\\""
  - id: b
    kind: command
    needs: [a]
    uses:
      - { connection: demo, access: propose }
    run: "grep -q changed \\"$RESOURCE_DEMO/item/v1/data.txt\\""
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    const work = workEntityDir(join(wf, "runs", "r1"), "demo", "item", "v1")
    expect(existsSync(work)).toBe(true)
    expect(readFileSync(join(work, "data.txt"), "utf8").trim()).toBe("changed")
    engine.close()
  })

  it("rejects unordered propose tasks on one connection", () => {
    const parsed = parseWorkflowYaml(`
id: bad-propose
tasks:
  - id: a
    kind: command
    run: echo a
    uses:
      - { connection: demo, access: propose }
  - id: b
    kind: command
    run: echo b
    uses:
      - { connection: demo, access: propose }
`)
    expect(parsed.workflow).toBeNull()
    expect(
      parsed.errors.some((e) => e.message.includes("must be ordered by needs"))
    ).toBe(true)
  })

  it("serial lock runs propose one at a time and shows why", async () => {
    const home = tempHome()
    const conn = writeConn(home, "locked", { label: "x" }, { serial: true })!
    expect(conn.serial).toBe(true)
    const wf = writeWorkflow(
      home,
      "serial-wf",
      `
id: serial-wf
limits:
  maxConcurrentRuns: 2
tasks:
  - id: hold
    kind: command
    uses:
      - { connection: locked, access: propose }
    run: "while [ ! -f \\"$WF_DIR/serial-gate\\" ]; do sleep 0.05; done; echo done"
`
    )
    const marker = join(wf, "serial-gate")
    const engine = createEngine({ home })
    const first = await engine.startRun({ workflowDir: wf, runId: "r1" })
    await new Promise<void>((resolve, reject) => {
      const start = Date.now()
      const tick = () => {
        if (serialLocks.holder("locked")?.runId === "r1") {
          resolve()
          return
        }
        if (Date.now() - start > 10_000) {
          reject(
            new Error(
              `timed out waiting for serial hold; state=${JSON.stringify(first.state().tasks)}`
            )
          )
          return
        }
        setTimeout(tick, 20)
      }
      tick()
    })

    const second = await engine.startRun({ workflowDir: wf, runId: "r2" })
    expect(second.status).toBe("running")
    await new Promise<void>((resolve, reject) => {
      const start = Date.now()
      const tick = () => {
        const reason = serialLocks.waitingReason("r2", "hold")
        if (reason?.includes("serial connection locked")) {
          resolve()
          return
        }
        if (Date.now() - start > 10_000) {
          const st = second.state()
          reject(
            new Error(
              `timed out waiting for waitingReason; holder=${JSON.stringify(serialLocks.holder("locked"))} reason=${reason} secondStatus=${st.status} task=${JSON.stringify(st.tasks.hold)}`
            )
          )
          return
        }
        setTimeout(tick, 20)
      }
      tick()
    })
    expect(serialLocks.waitingReason("r2", "hold")).toMatch(
      /serial connection locked/
    )

    writeFileSync(marker, "go")
    const s1 = await first.wait()
    const s2 = await second.wait()
    expect(s1.status).toBe("succeeded")
    expect(s2.status).toBe("succeeded")
    engine.close()
  }, 30_000)

  it("diffs work vs base, empty diff, and destructive flag", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "x" })
    const wf = writeWorkflow(
      home,
      "diff-wf",
      `
id: diff-wf
tasks:
  - id: a
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "true"
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    await handle.wait()
    const runRoot = join(wf, "runs", "r1")

    const empty = await diffWorkCopy({
      home,
      runRoot,
      connectionId: "demo",
    })
    expect(empty.changeSet.ops).toEqual([])
    expect(empty.previewMd).toMatch(/No changes/)

    writeFileSync(
      join(workEntityDir(runRoot, "demo", "item", "x"), "data.txt"),
      "edited"
    )
    writeFileSync(
      join(workEntityDir(runRoot, "demo", "item", "x"), "gone.destructive"),
      "__destructive__ wipe"
    )
    const changed = await diffWorkCopy({
      home,
      runRoot,
      connectionId: "demo",
    })
    expect(changed.changeSet.ops.length).toBeGreaterThanOrEqual(2)
    expect(changed.changeSet.ops.some((o) => o.destructive)).toBe(true)
    expect(changed.previewMd).toMatch(/destructive/)
    engine.close()
  })

  it("records a Local effect for unpublished changes at run end", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "x" })
    const wf = writeWorkflow(
      home,
      "local-effect",
      `
id: local-effect
tasks:
  - id: a
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "echo new > \\"$RESOURCE_DEMO/item/x/data.txt\\""
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    const events = engine.events("r1")
    const local = events.find((e) => e.type === "work_copy_changed")
    expect(local).toMatchObject({
      type: "work_copy_changed",
      connection: "demo",
      impact: "local",
    })
    engine.close()
  })

  it("deleting a run removes its work copies", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "x" })
    const wf = writeWorkflow(
      home,
      "delete-work",
      `
id: delete-work
tasks:
  - id: a
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "echo hi > \\"$RESOURCE_DEMO/item/x/data.txt\\""
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    await handle.wait()
    const work = join(wf, "runs", "r1", "work")
    expect(existsSync(work)).toBe(true)
    engine.deleteRun("r1")
    expect(existsSync(work)).toBe(false)
    expect(existsSync(join(wf, "runs", "r1"))).toBe(false)
    engine.close()
  })

  it("git clone --shared work copy allows commit; library has gc.auto=0", () => {
    const home = tempHome()
    const src = join(home, "repo-src")
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, "readme.txt"), "hello")
    execFileSync("git", ["-C", src, "init"], { stdio: "ignore" })
    execFileSync("git", ["-C", src, "config", "user.email", "t@example.com"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", src, "config", "user.name", "test"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", src, "add", "."], { stdio: "ignore" })
    execFileSync("git", ["-C", src, "commit", "-m", "init"], {
      stdio: "ignore",
    })

    const dest = join(home, "work-repo")
    copyPinnedEntity(src, dest)
    ensureLibraryGcAutoOff(src)
    const gc = execFileSync("git", ["-C", src, "config", "gc.auto"], {
      encoding: "utf8",
    }).trim()
    expect(gc).toBe("0")

    writeFileSync(join(dest, "readme.txt"), "hello world")
    execFileSync("git", ["-C", dest, "add", "."], { stdio: "ignore" })
    execFileSync("git", ["-C", dest, "config", "user.email", "t@example.com"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", dest, "config", "user.name", "test"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", dest, "commit", "-m", "edit"], {
      stdio: "ignore",
    })
    const log = execFileSync("git", ["-C", dest, "log", "--oneline"], {
      encoding: "utf8",
    })
    expect(log).toMatch(/edit/)
  })
})

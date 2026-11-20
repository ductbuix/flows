import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createEngine } from "./engine.ts"
import { EventLog } from "./event-log.ts"
import { foldEvents, isOpenAttempt } from "./fold.ts"
import { appDbPath } from "./paths.ts"
import { isPidAlive } from "./pid.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-approval-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, id: string, yaml: string): string {
  const workflowDir = join(home, "workflows", id)
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), yaml)
  return workflowDir
}

function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("timed out waiting"))
        return
      }
      setTimeout(tick, 25)
    }
    tick()
  })
}

describe("approval gates", () => {
  it("holds a gated task in awaiting_approval until approve", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "gate",
      `
id: gate
tasks:
  - id: a
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
    approval: true
`
    )
    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir, runId: "r1" })

    await waitFor(() => handle.state().tasks.a?.status === "awaiting_approval")
    expect(handle.state().status).toBe("running")
    expect(handle.state().tasks.a?.attempts.some(isOpenAttempt)).toBe(false)

    engine.approveTask("r1", "a")
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.a?.status).toBe("succeeded")
    expect(state.tasks.a?.approved).toBe(true)
    engine.close()
  }, 20_000)

  it("reject ends the task failed with reason rejected", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "reject",
      `
id: reject
tasks:
  - id: a
    kind: command
    run: "echo no"
    approval: true
`
    )
    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir, runId: "r2" })
    await waitFor(() => handle.state().tasks.a?.status === "awaiting_approval")

    engine.rejectTask("r2", "a")
    const state = await handle.wait()
    expect(state.tasks.a?.status).toBe("failed")
    expect(state.tasks.a?.failReason).toBe("rejected")
    expect(state.status).toBe("failed")
    engine.close()
  }, 20_000)

  it("waiting task survives restart and holds no running slot", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "resume-gate",
      `
id: resume-gate
tasks:
  - id: gated
    kind: command
    run: "echo gated"
    approval: true
  - id: free
    kind: command
    run: "printf done > \\"$WF_DIR/free.txt\\""
`
    )
    const marker = join(workflowDir, "free.txt")
    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir, runId: "r3" })

    await waitFor(
      () => handle.state().tasks.gated?.status === "awaiting_approval"
    )
    await waitFor(() => existsSync(marker))
    expect(handle.state().tasks.free?.status).toBe("succeeded")
    expect(handle.state().tasks.gated?.status).toBe("awaiting_approval")

    engine.close()

    const engine2 = createEngine({ home })
    const resumed = engine2.resumeRun("r3")
    expect(resumed).not.toBeNull()
    expect(resumed!.state().tasks.gated?.status).toBe("awaiting_approval")

    engine2.approveTask("r3", "gated")
    const state = await resumed!.wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.gated?.status).toBe("succeeded")
    expect(foldEvents(engine2.events("r3"))).toEqual(state)
    engine2.close()
  }, 20_000)
})

describe("cancel run", () => {
  it("cancels unfinished tasks and ends running process groups", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "cancel",
      `
id: cancel
tasks:
  - id: slow
    kind: command
    run: "printf x > \\"$WF_DIR/started.txt\\" && sleep 30"
  - id: later
    kind: command
    run: "echo later"
    needs: [slow]
`
    )
    const started = join(workflowDir, "started.txt")
    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir, runId: "c1" })

    await waitFor(() => existsSync(started))
    await waitFor(() => handle.state().tasks.slow?.status === "running")

    const pid = handle.state().tasks.slow?.attempts[0]?.pid
    expect(pid).toBeDefined()
    expect(isPidAlive(pid!)).toBe(true)

    engine.cancelRun("c1")
    const state = await handle.wait()
    expect(state.status).toBe("cancelled")
    expect(state.tasks.slow?.status).toBe("cancelled")
    expect(state.tasks.later?.status).toBe("cancelled")
    await waitFor(() => !isPidAlive(pid!))
    engine.close()
  }, 20_000)
})

describe("run deletion", () => {
  it("appends run_deleted, removes files, and hides the run", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "del",
      `
id: del
tasks:
  - id: a
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
`
    )
    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir, runId: "d1" })
    await handle.wait()

    const runRoot = join(workflowDir, "runs", "d1")
    expect(existsSync(runRoot)).toBe(true)

    engine.deleteRun("d1")
    expect(existsSync(runRoot)).toBe(false)
    expect(engine.fold("d1")?.deleted).toBe(true)
    expect(engine.listRuns().map((r) => r.runId)).not.toContain("d1")
    engine.close()
  }, 20_000)

  it("resume finishes an interrupted removal", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "del2",
      `
id: del2
tasks:
  - id: a
    kind: command
    run: "echo a"
`
    )
    const engine = createEngine({ home })
    await engine.startRun({ workflowDir, runId: "d2" }).wait()

    const log = new EventLog(appDbPath(home))
    log.append({
      type: "run_deleted",
      runId: "d2",
      at: new Date().toISOString(),
    })
    log.close()

    const runRoot = join(workflowDir, "runs", "d2")
    expect(existsSync(runRoot)).toBe(true)

    const engine2 = createEngine({ home })
    engine2.resumeAll()
    expect(existsSync(runRoot)).toBe(false)
    expect(engine2.listRuns()).toEqual([])
    engine2.close()
  }, 20_000)

  it("refuses to delete a live run", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "live",
      `
id: live
tasks:
  - id: a
    kind: command
    run: "sleep 30"
    approval: true
`
    )
    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir, runId: "d3" })
    await waitFor(() => handle.state().tasks.a?.status === "awaiting_approval")
    expect(() => engine.deleteRun("d3")).toThrow(/live/)
    engine.cancelRun("d3")
    await handle.wait()
    engine.close()
  }, 20_000)
})

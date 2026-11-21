import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createEngine } from "./engine.ts"
import { foldEvents } from "./fold.ts"
import { summarizeRun } from "./run-summary.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-summary-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, id: string, yaml: string): string {
  const workflowDir = join(home, "workflows", id)
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), yaml)
  return workflowDir
}

describe("summarizeRun", () => {
  it("lists needsYou and firstFailedTaskId from task state", () => {
    const state = foldEvents([
      {
        type: "run_started",
        runId: "r1",
        workflowId: "w1",
        graph: {
          id: "w1",
          tasks: [
            { id: "a", kind: "command", run: "echo a", needs: [] },
            { id: "b", kind: "command", run: "echo b", needs: [] },
            { id: "c", kind: "command", run: "echo c", needs: [] },
          ],
        },
        at: "2026-01-01T00:00:00.000Z",
        itemKey: "key1",
      },
      {
        type: "approval_requested",
        runId: "r1",
        taskId: "a",
        at: "2026-01-01T00:00:01.000Z",
      },
      {
        type: "attempt_started",
        runId: "r1",
        taskId: "b",
        attempt: 1,
        at: "2026-01-01T00:00:02.000Z",
      },
      {
        type: "attempt_finished",
        runId: "r1",
        taskId: "b",
        attempt: 1,
        exitCode: 1,
        at: "2026-01-01T00:00:03.000Z",
      },
    ])
    expect(state).not.toBeNull()
    const summary = summarizeRun(state!)
    expect(summary).toMatchObject({
      id: "r1",
      workflowId: "w1",
      workflowName: "w1",
      status: "running",
      needsYou: [{ taskId: "a" }],
      taskCounts: { done: 1, total: 3 },
      firstFailedTaskId: "b",
      itemKey: "key1",
      startedAt: "2026-01-01T00:00:00.000Z",
    })
    expect(summary?.finishedAt).toBeUndefined()
  })
})

describe("Engine run summary cache", () => {
  it("second listRunSummaries call folds nothing", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "ok",
      `
id: ok
tasks:
  - id: a
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir, runId: "r-cache" })
    await handle.wait()

    const spy = vi.spyOn(engine, "fold")
    const first = engine.listRunSummaries()
    const second = engine.listRunSummaries()
    expect(spy).not.toHaveBeenCalled()
    expect(first).toEqual(second)
    expect(first[0]).toMatchObject({
      id: "r-cache",
      status: "succeeded",
      taskCounts: { done: 1, total: 1 },
    })
    spy.mockRestore()
    engine.close()
  }, 20_000)

  it("rebuilds summaries after resume on a new engine", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "ok",
      `
id: ok
tasks:
  - id: a
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
`
    )
    const engine = createEngine({ home })
    await (await engine.startRun({ workflowDir, runId: "r-resume" })).wait()
    engine.close()

    const again = createEngine({ home })
    again.resumeAll()
    const summaries = again.listRunSummaries()
    expect(summaries).toHaveLength(1)
    expect(summaries[0]?.id).toBe("r-resume")
    expect(summaries[0]?.status).toBe("succeeded")

    const spy = vi.spyOn(again, "fold")
    again.listRunSummaries()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    again.close()
  }, 20_000)
})

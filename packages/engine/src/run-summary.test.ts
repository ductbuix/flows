import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createEngine } from "./engine.ts"
import { workflowSchema } from "@workspace/shared"
import { foldEvents } from "./nodes/run-state.ts"
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

const graph = workflowSchema.parse({
  id: "ok",
  nodes: [
    { id: "t", kind: "trigger", type: "manual" },
    { id: "a", kind: "command", run: "echo ok" },
    { id: "o", kind: "output", target: "folder" },
  ],
  edges: [
    { from: "t", to: "a" },
    { from: "a", to: "o" },
  ],
})

describe("summarizeRun", () => {
  it("lists needsYou and firstFailedTaskId from step state", () => {
    const wf = workflowSchema.parse({
      id: "w1",
      nodes: [
        { id: "a", kind: "approval", question: "Go?" },
        { id: "b", kind: "command", run: "echo b" },
        { id: "c", kind: "command", run: "echo c" },
      ],
      edges: [],
    })
    const at = (n: number) => `2026-01-01T00:00:0${n}.000Z`
    const state = foldEvents([
      {
        type: "run_started",
        runId: "r1",
        workflowId: "w1",
        graph: wf,
        at: at(0),
        itemKey: "key1",
      },
      { type: "step_started", runId: "r1", nodeId: "a", pass: 1, at: at(1) },
      {
        type: "approval_requested",
        runId: "r1",
        taskId: "a",
        nodeId: "a",
        pass: 1,
        question: "Go?",
        at: at(1),
      },
      { type: "step_started", runId: "r1", nodeId: "b", pass: 1, at: at(2) },
      {
        type: "attempt_started",
        runId: "r1",
        taskId: "b",
        nodeId: "b",
        pass: 1,
        attempt: 1,
        at: at(2),
      },
      {
        type: "attempt_finished",
        runId: "r1",
        taskId: "b",
        nodeId: "b",
        pass: 1,
        attempt: 1,
        exitCode: 1,
        at: at(3),
      },
      {
        type: "step_failed",
        runId: "r1",
        nodeId: "b",
        pass: 1,
        reason: "exit",
        at: at(3),
      },
    ])
    expect(state).not.toBeNull()
    const summary = summarizeRun(state!)
    expect(summary).toMatchObject({
      id: "r1",
      workflowId: "w1",
      workflowName: "w1",
      status: "running",
      needsYou: [{ taskId: "a", question: "Go?" }],
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
    const engine = createEngine({ home })
    const handle = engine.startNodeRun({ graph, runId: "r-cache" })
    await handle.wait()

    const spy = vi.spyOn(engine, "fold")
    const first = engine.listRunSummaries()
    const second = engine.listRunSummaries()
    expect(spy).not.toHaveBeenCalled()
    expect(first).toEqual(second)
    expect(first[0]).toMatchObject({
      id: "r-cache",
      status: "succeeded",
      taskCounts: { done: 3, total: 3 },
    })
    spy.mockRestore()
    engine.close()
  }, 20_000)

  it("rebuilds summaries after resume on a new engine", async () => {
    const home = tempHome()
    const engine = createEngine({ home })
    await engine.startNodeRun({ graph, runId: "r-resume" }).wait()
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

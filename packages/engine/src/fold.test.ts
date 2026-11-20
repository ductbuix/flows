import { describe, expect, it } from "vitest"
import type { EngineEvent, Workflow } from "@workspace/shared"
import { foldEvents, readyTaskIds } from "./fold.ts"

const graph: Workflow = {
  id: "diamond",
  tasks: [
    { id: "a", kind: "command", run: "echo a", needs: [] },
    { id: "b", kind: "command", run: "echo b", needs: ["a"] },
    { id: "c", kind: "command", run: "echo c", needs: ["a"] },
    { id: "d", kind: "command", run: "echo d", needs: ["b", "c"] },
  ],
}

function started(): EngineEvent {
  return {
    type: "run_started",
    runId: "r1",
    workflowId: "diamond",
    graph,
    at: "t0",
  }
}

describe("foldEvents", () => {
  it("starts every task pending", () => {
    const state = foldEvents([started()])
    expect(state?.status).toBe("running")
    expect(readyTaskIds(state!)).toEqual(["a"])
    expect(state?.tasks.a?.status).toBe("pending")
  })

  it("marks a task running then succeeded from attempt events", () => {
    const state = foldEvents([
      started(),
      {
        type: "attempt_started",
        runId: "r1",
        taskId: "a",
        attempt: 1,
        at: "t1",
      },
      {
        type: "attempt_launched",
        runId: "r1",
        taskId: "a",
        attempt: 1,
        pid: 42,
        at: "t2",
      },
      {
        type: "attempt_finished",
        runId: "r1",
        taskId: "a",
        attempt: 1,
        exitCode: 0,
        at: "t3",
      },
    ])
    expect(state?.tasks.a?.status).toBe("succeeded")
    expect(state?.tasks.a?.attempts[0]).toEqual({
      attempt: 1,
      pid: 42,
      exitCode: 0,
    })
    expect(readyTaskIds(state!).sort()).toEqual(["b", "c"])
  })

  it("fails the task on non-zero exit", () => {
    const state = foldEvents([
      started(),
      {
        type: "attempt_started",
        runId: "r1",
        taskId: "a",
        attempt: 1,
        at: "t1",
      },
      {
        type: "attempt_finished",
        runId: "r1",
        taskId: "a",
        attempt: 1,
        exitCode: 7,
        at: "t2",
      },
      { type: "run_failed", runId: "r1", at: "t3" },
    ])
    expect(state?.tasks.a?.status).toBe("failed")
    expect(state?.status).toBe("failed")
    expect(readyTaskIds(state!)).toEqual([])
  })
})

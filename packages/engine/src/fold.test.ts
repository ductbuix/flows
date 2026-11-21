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
    expect(state?.sandboxed).toBe(true)
  })

  it("starts queued then activates to running", () => {
    const state = foldEvents([
      {
        type: "run_started",
        runId: "r1",
        workflowId: "diamond",
        graph,
        at: "t0",
        queued: true,
        source: "manual",
        itemKey: "abc",
        inputHash: "def",
        files: ["inputs.json"],
      },
      { type: "run_activated", runId: "r1", at: "t1" },
    ])
    expect(state?.status).toBe("running")
    expect(state?.itemKey).toBe("abc")
    expect(state?.startedAt).toBe("t0")
  })

  it("clears sandboxed when an unrestricted attempt launches", () => {
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
        sandboxed: false,
        at: "t2",
      },
    ])
    expect(state?.sandboxed).toBe(false)
  })

  it("keeps sandboxed when launches report sandboxed true", () => {
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
        sandboxed: true,
        at: "t2",
      },
    ])
    expect(state?.sandboxed).toBe(true)
  })

  it("records model, effort, and modelSource on attempt_launched", () => {
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
        pid: 7,
        sandboxed: true,
        model: "opus",
        effort: "high",
        modelSource: "task",
        at: "t2",
      },
    ])
    const attempt = state?.tasks.a?.attempts[0]
    expect(attempt).toMatchObject({
      model: "opus",
      effort: "high",
      modelSource: "task",
    })
  })

  it("records portBase and portCount on attempt_launched", () => {
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
        pid: 7,
        sandboxed: true,
        portBase: 22000,
        portCount: 10,
        at: "t2",
      },
    ])
    expect(state?.tasks.a?.attempts[0]).toMatchObject({
      portBase: 22000,
      portCount: 10,
    })
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
      startedAt: "t1",
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

  it("marks the attempt interrupted and the task failed", () => {
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
        pid: 9,
        at: "t2",
      },
      {
        type: "attempt_interrupted",
        runId: "r1",
        taskId: "a",
        attempt: 1,
        at: "t3",
      },
    ])
    expect(state?.tasks.a?.status).toBe("failed")
    expect(state?.tasks.a?.attempts[0]?.interrupted).toBe(true)
    expect(readyTaskIds(state!)).toEqual([])
  })

  it("moves a gated task through approval and reject", () => {
    const gated: Workflow = {
      id: "g",
      tasks: [
        { id: "a", kind: "command", run: "echo a", needs: [], approval: true },
      ],
    }
    const base = {
      type: "run_started" as const,
      runId: "r1",
      workflowId: "g",
      graph: gated,
      at: "t0",
    }
    const waiting = foldEvents([
      base,
      { type: "approval_requested", runId: "r1", taskId: "a", at: "t1" },
    ])
    expect(waiting?.tasks.a?.status).toBe("awaiting_approval")

    const approved = foldEvents([
      base,
      { type: "approval_requested", runId: "r1", taskId: "a", at: "t1" },
      { type: "task_approved", runId: "r1", taskId: "a", at: "t2" },
    ])
    expect(approved?.tasks.a?.approved).toBe(true)
    expect(approved?.tasks.a?.status).toBe("awaiting_approval")

    const rejected = foldEvents([
      base,
      { type: "approval_requested", runId: "r1", taskId: "a", at: "t1" },
      {
        type: "task_rejected",
        runId: "r1",
        taskId: "a",
        reason: "rejected",
        at: "t2",
      },
    ])
    expect(rejected?.tasks.a?.status).toBe("failed")
    expect(rejected?.tasks.a?.failReason).toBe("rejected")
  })

  it("cancels unfinished tasks and keeps cancelled after attempt exit", () => {
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
        pid: 1,
        at: "t2",
      },
      { type: "cancel_requested", runId: "r1", at: "t3" },
      { type: "task_cancelled", runId: "r1", taskId: "a", at: "t4" },
      { type: "task_cancelled", runId: "r1", taskId: "b", at: "t5" },
      { type: "task_cancelled", runId: "r1", taskId: "c", at: "t6" },
      { type: "task_cancelled", runId: "r1", taskId: "d", at: "t7" },
      { type: "run_cancelled", runId: "r1", at: "t8" },
      {
        type: "attempt_finished",
        runId: "r1",
        taskId: "a",
        attempt: 1,
        exitCode: 1,
        at: "t9",
      },
    ])
    expect(state?.status).toBe("cancelled")
    expect(state?.tasks.a?.status).toBe("cancelled")
    expect(state?.tasks.a?.attempts[0]?.exitCode).toBe(1)
    expect(state?.deleted).toBeUndefined()
  })

  it("marks a run deleted", () => {
    const state = foldEvents([
      started(),
      { type: "run_succeeded", runId: "r1", at: "t1" },
      { type: "run_deleted", runId: "r1", at: "t2" },
    ])
    expect(state?.deleted).toBe(true)
    expect(state?.status).toBe("succeeded")
  })

  it("manual retry reopens the run and resets dependants", () => {
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
        exitCode: 1,
        at: "t2",
      },
      {
        type: "task_skipped",
        runId: "r1",
        taskId: "b",
        reason: "when",
        at: "t3",
      },
      {
        type: "task_skipped",
        runId: "r1",
        taskId: "c",
        reason: "when",
        at: "t4",
      },
      {
        type: "task_skipped",
        runId: "r1",
        taskId: "d",
        reason: "upstream_skip",
        at: "t5",
      },
      { type: "run_failed", runId: "r1", at: "t6" },
      { type: "task_retry_requested", runId: "r1", taskId: "a", at: "t7" },
    ])
    expect(state?.status).toBe("running")
    expect(state?.cancelRequested).toBe(false)
    expect(state?.tasks.a?.status).toBe("pending")
    expect(state?.tasks.a?.manualRetryPending).toBe(true)
    expect(state?.tasks.b?.status).toBe("pending")
    expect(state?.tasks.c?.status).toBe("pending")
    expect(state?.tasks.d?.status).toBe("pending")
    expect(state?.tasks.a?.attempts).toHaveLength(1)

    const launched = foldEvents([
      ...(state
        ? [
            started(),
            {
              type: "attempt_started" as const,
              runId: "r1",
              taskId: "a",
              attempt: 1,
              at: "t1",
            },
            {
              type: "attempt_finished" as const,
              runId: "r1",
              taskId: "a",
              attempt: 1,
              exitCode: 1,
              at: "t2",
            },
            { type: "run_failed" as const, runId: "r1", at: "t3" },
            {
              type: "task_retry_requested" as const,
              runId: "r1",
              taskId: "a",
              at: "t4",
            },
            {
              type: "attempt_started" as const,
              runId: "r1",
              taskId: "a",
              attempt: 2,
              at: "t5",
            },
          ]
        : []),
    ])
    expect(launched?.tasks.a?.manualRetryPending).toBeUndefined()
    expect(launched?.tasks.a?.attempts[1]?.manualRetry).toBe(true)
  })
})

import { describe, expect, it } from "vitest"
import type { EngineEvent } from "@workspace/shared"
import { foldSteps, latestStep } from "./fold-steps.ts"

const base = { runId: "r1", at: "t" }
const ev = (e: Record<string, unknown>) =>
  ({ ...base, ...e }) as unknown as EngineEvent

describe("foldSteps", () => {
  it("runs a step to done with outputs, branch and answer", () => {
    const s = foldSteps([
      ev({ type: "step_started", nodeId: "a", pass: 1 }),
      ev({
        type: "attempt_started",
        taskId: "a",
        nodeId: "a",
        pass: 1,
        attempt: 1,
      }),
      ev({
        type: "attempt_launched",
        taskId: "a",
        nodeId: "a",
        pass: 1,
        attempt: 1,
        pid: 42,
        timeout: 9,
      }),
      ev({
        type: "attempt_finished",
        taskId: "a",
        nodeId: "a",
        pass: 1,
        attempt: 1,
        exitCode: 0,
      }),
      ev({
        type: "step_done",
        nodeId: "a",
        pass: 1,
        outputs: ["out/x"],
        branch: "yes",
        answer: { ok: true },
      }),
    ])
    expect(s.steps.a).toEqual([
      {
        nodeId: "a",
        pass: 1,
        status: "done",
        attempts: 1,
        outputs: ["out/x"],
        branch: "yes",
        answer: { ok: true },
        current: {
          attempt: 1,
          startedAt: "t",
          open: false,
          pid: 42,
          timeout: 9,
          exitCode: 0,
          reason: undefined,
          endedAt: "t",
        },
        seq: 5,
      },
    ])
  })

  it("tracks running, failed, skipped and cancelled", () => {
    const s = foldSteps([
      ev({ type: "step_started", nodeId: "a", pass: 1 }),
      ev({ type: "step_started", nodeId: "b", pass: 1 }),
      ev({ type: "step_failed", nodeId: "b", pass: 1, reason: "exit" }),
      ev({ type: "step_skipped", nodeId: "c", pass: 1 }),
      ev({ type: "step_cancelled", nodeId: "d", pass: 1 }),
    ])
    expect(latestStep(s, "a")?.status).toBe("running")
    expect(latestStep(s, "b")).toMatchObject({
      status: "failed",
      failReason: "exit",
    })
    expect(latestStep(s, "c")?.status).toBe("skipped")
    expect(latestStep(s, "d")?.status).toBe("cancelled")
  })

  it("holds approval as waiting, then running on approve", () => {
    const events = [
      ev({ type: "step_started", nodeId: "a", pass: 1 }),
      ev({ type: "approval_requested", taskId: "a" }),
    ]
    expect(latestStep(foldSteps(events), "a")?.status).toBe("waiting")
    const approved = foldSteps([
      ...events,
      ev({ type: "step_approved", nodeId: "a", pass: 1 }),
    ])
    expect(latestStep(approved, "a")?.status).toBe("running")
  })

  it("rejects to cancelled", () => {
    const s = foldSteps([
      ev({ type: "step_started", nodeId: "a", pass: 1 }),
      ev({ type: "step_rejected", nodeId: "a", pass: 1 }),
    ])
    expect(latestStep(s, "a")?.status).toBe("cancelled")
  })

  it("keeps one step per pass, ordered", () => {
    const s = foldSteps([
      ev({ type: "step_done", nodeId: "a", pass: 1 }),
      ev({ type: "step_started", nodeId: "a", pass: 2 }),
    ])
    expect(s.steps.a?.map((x) => [x.pass, x.status])).toEqual([
      [1, "done"],
      [2, "running"],
    ])
    expect(latestStep(s, "a")?.pass).toBe(2)
  })

  it("counts retry attempts in the same pass", () => {
    const s = foldSteps([
      ev({ type: "step_started", nodeId: "a", pass: 1 }),
      ev({
        type: "attempt_started",
        taskId: "a",
        nodeId: "a",
        pass: 1,
        attempt: 1,
      }),
      ev({
        type: "attempt_started",
        taskId: "a",
        nodeId: "a",
        pass: 1,
        attempt: 2,
      }),
    ])
    expect(s.steps.a).toHaveLength(1)
    expect(latestStep(s, "a")?.attempts).toBe(2)
  })

  it("manual retry reopens the step and the run", () => {
    const s = foldSteps([
      ev({ type: "step_failed", nodeId: "a", pass: 1, reason: "timeout" }),
      ev({ type: "run_failed" }),
      ev({ type: "step_retry_requested", nodeId: "a", pass: 1 }),
    ])
    expect(latestStep(s, "a")).toMatchObject({ status: "pending" })
    expect(latestStep(s, "a")?.failReason).toBeUndefined()
    expect(s.ended).toBe(false)
  })

  it("marks the run ended and ignores events it does not fold", () => {
    const s = foldSteps([
      ev({ type: "cancel_requested" }),
      ev({ type: "run_succeeded" }),
    ])
    expect(s.steps).toEqual({})
    expect(s.ended).toBe(true)
  })
})

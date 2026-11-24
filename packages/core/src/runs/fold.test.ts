import { describe, expect, it } from "vitest"
import type { EngineEvent } from "@workspace/contracts"
import { fold, foldAll, foldAllSteps } from "./fold.ts"
import { latestStep } from "./model.ts"

const base = { runId: "r1", at: "t0" }
const ev = (e: Record<string, unknown>) =>
  ({ ...base, ...e }) as unknown as EngineEvent

const graph = {
  id: "wf",
  nodes: [
    { id: "t", kind: "trigger", type: "manual" },
    { id: "a", kind: "command", run: "true" },
  ],
  edges: [{ from: "t", to: "a" }],
}

describe("fold", () => {
  it("builds run state from run_started and ignores unknown before it", () => {
    expect(
      fold(null, ev({ type: "step_started", nodeId: "a", pass: 1 }))
    ).toBeNull()
    const s = fold(null, {
      type: "run_started",
      runId: "r1",
      at: "t0",
      workflowId: "wf",
      graph: graph as never,
      trigger: "t",
    })
    expect(s).toMatchObject({
      runId: "r1",
      status: "running",
      trigger: "t",
      seq: 1,
    })
  })

  it.each([
    {
      name: "done with outputs and branch",
      events: [
        ev({ type: "step_started", nodeId: "a", pass: 1 }),
        ev({
          type: "step_done",
          nodeId: "a",
          pass: 1,
          outputs: ["out/x"],
          branch: "yes",
        }),
      ],
      want: { status: "done", outputs: ["out/x"], branch: "yes" },
    },
    {
      name: "approval waiting then approved",
      events: [
        ev({ type: "step_started", nodeId: "a", pass: 1 }),
        ev({
          type: "approval_requested",
          taskId: "a",
          nodeId: "a",
          pass: 1,
        }),
        ev({ type: "step_approved", nodeId: "a", pass: 1 }),
      ],
      want: { status: "running", decision: "approved" },
    },
  ])("table: $name", ({ events, want }) => {
    const s = foldAllSteps(events as EngineEvent[])
    expect(latestStep(s, "a")).toMatchObject(want)
  })

  it("manual retry reopens an ended run", () => {
    const state = foldAll([
      {
        type: "run_started",
        runId: "r1",
        at: "t0",
        workflowId: "wf",
        graph: graph as never,
      },
      ev({ type: "step_failed", nodeId: "a", pass: 1, reason: "exit" }),
      ev({ type: "run_failed" }),
      ev({ type: "step_retry_requested", nodeId: "a", pass: 1 }),
    ] as EngineEvent[])
    expect(state?.status).toBe("running")
    expect(latestStep(state!.steps, "a")?.status).toBe("pending")
    expect(state!.steps.ended).toBe(false)
  })
})

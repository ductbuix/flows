import { describe, expect, it } from "vitest"
import type { RunStep } from "@workspace/contracts"
import { statesFromSteps, stepToRunState } from "./node-run-view"

describe("node-run-view", () => {
  it("maps task statuses to canvas run states", () => {
    expect(stepToRunState("running")).toBe("running")
    expect(stepToRunState("succeeded")).toBe("done")
    expect(stepToRunState("failed")).toBe("failed")
    expect(stepToRunState("awaiting_approval")).toBe("waiting")
    expect(stepToRunState("pending")).toBeUndefined()
  })

  it("builds per-node views from steps", () => {
    const steps: RunStep[] = [
      {
        nodeId: "a",
        kind: "command",
        pass: 1,
        attempts: 1,
        status: "succeeded",
      },
      {
        nodeId: "b",
        kind: "command",
        pass: 1,
        attempts: 2,
        status: "failed",
        failReason: "exit 1",
      },
    ]
    expect(statesFromSteps(steps)).toEqual({
      a: {
        state: "done",
        attempts: 1,
        pass: 1,
        passes: [{ pass: 1, attempts: 1 }],
      },
      b: {
        state: "failed",
        attempts: 2,
        pass: 1,
        passes: [{ pass: 1, attempts: 2 }],
        failReason: "exit 1",
        result: "exit 1",
      },
    })
  })

  it("keeps every pass of a looped node", () => {
    const steps: RunStep[] = [
      { nodeId: "a", kind: "llm", pass: 2, attempts: 1, status: "running" },
      { nodeId: "a", kind: "llm", pass: 1, attempts: 2, status: "succeeded" },
    ]
    expect(statesFromSteps(steps).a).toMatchObject({
      state: "running",
      pass: 2,
      passes: [
        { pass: 1, attempts: 2 },
        { pass: 2, attempts: 1 },
      ],
    })
  })
})

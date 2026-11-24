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
      a: { state: "done", attempts: 1 },
      b: {
        state: "failed",
        attempts: 2,
        failReason: "exit 1",
        result: "exit 1",
      },
    })
  })
})

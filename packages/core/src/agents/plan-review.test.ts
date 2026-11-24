import { describe, expect, it } from "vitest"
import { createFakeClock } from "../testing/fake-clock.ts"
import {
  createPlanResult,
  createPlanReviewGate,
  parseCreatePlanParams,
  resolvePlanReview,
} from "./plan-review.ts"

const todos = [
  { id: "todo-1", content: "Inspect", status: "completed" as const },
  { id: "todo-2", content: "Update", status: "pending" as const },
]

describe("resolvePlanReview", () => {
  it("defaults to auto", () => {
    expect(resolvePlanReview(undefined)).toBe("auto")
    expect(resolvePlanReview("ask")).toBe("ask")
  })
})

describe("createPlanResult", () => {
  it("nests the ACP outcome envelope", () => {
    expect(createPlanResult("accepted")).toEqual({
      outcome: { outcome: "accepted" },
    })
    expect(createPlanResult("rejected", "no")).toEqual({
      outcome: { outcome: "rejected", reason: "no" },
    })
  })
})

describe("PlanReviewGate", () => {
  it("parks then resolves accepted", async () => {
    const clock = createFakeClock(Date.parse("2026-11-24T00:00:00.000Z"))
    const asked: unknown[] = []
    const gate = createPlanReviewGate({
      clock,
      onRequested: (event) => {
        asked.push(event)
      },
    })
    const pending = gate.ask({
      runId: "r1",
      nodeId: "llm",
      pass: 1,
      requestId: "call_1",
      name: "Refactor",
      plan: "1. Inspect\n2. Update",
      todos,
    })
    await Promise.resolve()
    expect(asked).toHaveLength(1)
    expect(gate.answer("plan_review:r1:llm:1:call_1", "accepted")).toBe(true)
    await expect(pending).resolves.toEqual({ outcome: "accepted" })
  })

  it("rejects unknown option ids", async () => {
    const gate = createPlanReviewGate({
      clock: createFakeClock(0),
      onRequested: () => {},
    })
    const pending = gate.ask({
      runId: "r1",
      nodeId: "n",
      pass: 1,
      requestId: "1",
      plan: "Do it",
      todos,
    })
    await Promise.resolve()
    expect(gate.answer("plan_review:r1:n:1:1", "approved")).toBe(false)
    expect(gate.answer("plan_review:r1:n:1:1", "rejected")).toBe(true)
    await expect(pending).resolves.toEqual({ outcome: "rejected" })
  })
})

describe("parseCreatePlanParams", () => {
  it("reads toolCallId, plan and todos", () => {
    expect(
      parseCreatePlanParams({
        toolCallId: "call_124",
        name: "Refactor tabs",
        overview: "Tighten layout",
        plan: "1. Inspect\n2. Update",
        todos,
        isProject: false,
      })
    ).toEqual({
      requestId: "call_124",
      name: "Refactor tabs",
      overview: "Tighten layout",
      plan: "1. Inspect\n2. Update",
      todos,
    })
  })
})

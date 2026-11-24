import { createFakeClock } from "@workspace/core/testing"
import { describe, expect, it } from "vitest"
import {
  acpAnsweredEvent,
  answerParkedAcpAsk,
  type AcpInboxGates,
} from "./acp-inbox-answer.ts"
import { createPermissionAskGate } from "./permission-ask.ts"
import { createPlanReviewGate } from "./plan-review.ts"
import { createQuestionAskGate } from "./question-ask.ts"

function gates(): AcpInboxGates {
  const clock = createFakeClock(0)
  return {
    permission: createPermissionAskGate({
      clock,
      onRequested: () => {},
      onAutoReject: () => {},
    }),
    question: createQuestionAskGate({
      clock,
      onRequested: () => {},
    }),
    planReview: createPlanReviewGate({
      clock,
      onRequested: () => {},
    }),
  }
}

describe("answerParkedAcpAsk", () => {
  it("returns false when no ask is parked", () => {
    const g = gates()
    expect(
      answerParkedAcpAsk(g, {
        kind: "permission",
        runId: "r1",
        at: "2026-11-24T00:00:00.000Z",
        nodeId: "n",
        pass: 1,
        requestId: "tc1",
        optionId: "allow-once",
      })
    ).toBe(false)
  })

  it("resolves permission, question and plan_review asks", async () => {
    const g = gates()
    const at = "2026-11-24T00:00:00.000Z"
    const pendingPerm = g.permission.ask({
      runId: "r1",
      nodeId: "n",
      pass: 1,
      tool: "tc1",
      requestId: "tc1",
      at,
    })
    const pendingQ = g.question.ask({
      runId: "r1",
      nodeId: "n",
      pass: 1,
      requestId: "q1",
      questions: [
        {
          id: "q1",
          prompt: "Pick",
          options: [{ id: "a", label: "A" }],
        },
      ],
      at,
    })
    const pendingPlan = g.planReview.ask({
      runId: "r1",
      nodeId: "n",
      pass: 1,
      requestId: "p1",
      plan: "do it",
      todos: [],
      at,
    })
    // ask() parks after the first microtask (onRequested await).
    await Promise.resolve()
    await Promise.resolve()

    expect(
      answerParkedAcpAsk(g, {
        kind: "permission",
        runId: "r1",
        at,
        nodeId: "n",
        pass: 1,
        requestId: "tc1",
        optionId: "allow-once",
      })
    ).toBe(true)
    expect(
      answerParkedAcpAsk(g, {
        kind: "question",
        runId: "r1",
        at,
        nodeId: "n",
        pass: 1,
        requestId: "q1",
        optionId: "answered",
        answers: [{ questionId: "q1", selectedOptionIds: ["a"] }],
      })
    ).toBe(true)
    expect(
      answerParkedAcpAsk(g, {
        kind: "plan_review",
        runId: "r1",
        at,
        nodeId: "n",
        pass: 1,
        requestId: "p1",
        optionId: "accepted",
      })
    ).toBe(true)

    await expect(pendingPerm).resolves.toBe("allow-once")
    await expect(pendingQ).resolves.toMatchObject({ outcome: "answered" })
    await expect(pendingPlan).resolves.toMatchObject({ outcome: "accepted" })
  })

  it("builds answered events per kind", () => {
    const base = {
      runId: "r1",
      at: "2026-11-24T00:00:00.000Z",
      nodeId: "n",
      pass: 1,
      requestId: "x",
    }
    expect(
      acpAnsweredEvent({ ...base, kind: "permission", optionId: "reject-once" })
    ).toMatchObject({ type: "permission_answered", optionId: "reject-once" })
    expect(
      acpAnsweredEvent({ ...base, kind: "question", optionId: "skipped" })
    ).toMatchObject({ type: "question_answered", outcome: "skipped" })
    expect(
      acpAnsweredEvent({ ...base, kind: "plan_review", optionId: "rejected" })
    ).toMatchObject({ type: "plan_review_answered", outcome: "rejected" })
  })
})

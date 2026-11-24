import type { CursorAskAnswer, EngineEvent } from "@workspace/contracts"
import {
  permissionItemId,
  planReviewItemId,
  questionItemId,
} from "../inbox/projection.ts"
import type { PermissionAskGate } from "./permission-ask.ts"
import type { PlanReviewGate } from "./plan-review.ts"
import type { QuestionAskGate } from "./question-ask.ts"

/** Live parked ACP asks held by the daemon (BL-192). */
export type AcpInboxGates = {
  permission: PermissionAskGate
  question: QuestionAskGate
  planReview: PlanReviewGate
}

export type AcpInboxAnswerInput = {
  kind: "permission" | "question" | "plan_review"
  runId: string
  at: string
  nodeId: string
  pass: number
  requestId: string
  optionId: string
  answers?: readonly CursorAskAnswer[]
}

/** Resolve a parked ask. Returns false when the session/gate entry is gone. */
export function answerParkedAcpAsk(
  gates: AcpInboxGates,
  input: AcpInboxAnswerInput
): boolean {
  if (input.kind === "permission") {
    return gates.permission.answer(
      permissionItemId(input.runId, input.nodeId, input.pass, input.requestId),
      input.optionId
    )
  }
  if (input.kind === "question") {
    return gates.question.answer(
      questionItemId(input.runId, input.nodeId, input.pass, input.requestId),
      input.optionId,
      input.answers
    )
  }
  return gates.planReview.answer(
    planReviewItemId(input.runId, input.nodeId, input.pass, input.requestId),
    input.optionId
  )
}

/** Answer event to append after a successful gate resolve (BL-192). */
export function acpAnsweredEvent(input: AcpInboxAnswerInput): EngineEvent {
  if (input.kind === "permission") {
    return {
      type: "permission_answered",
      runId: input.runId,
      at: input.at,
      nodeId: input.nodeId,
      pass: input.pass,
      requestId: input.requestId,
      optionId: input.optionId as "allow-once" | "allow-always" | "reject-once",
    }
  }
  if (input.kind === "question") {
    return {
      type: "question_answered",
      runId: input.runId,
      at: input.at,
      nodeId: input.nodeId,
      pass: input.pass,
      requestId: input.requestId,
      outcome: input.optionId as "answered" | "skipped",
      ...(input.answers ? { answers: [...input.answers] } : {}),
    }
  }
  return {
    type: "plan_review_answered",
    runId: input.runId,
    at: input.at,
    nodeId: input.nodeId,
    pass: input.pass,
    requestId: input.requestId,
    outcome: input.optionId as "accepted" | "rejected",
  }
}

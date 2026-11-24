import type { EngineEvent } from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import {
  acpAnsweredEvent,
  answerParkedAcpAsk,
  type AcpInboxAnswerInput,
  type AcpInboxGates,
} from "./acp-inbox-answer.ts"
import { createPermissionAskGate } from "./permission-ask.ts"
import { createPlanReviewGate } from "./plan-review.ts"
import { createQuestionAskGate } from "./question-ask.ts"

const systemClock: Clock = { now: () => Date.now() }

export type AcpAsks = {
  gates: AcpInboxGates
  answer(input: AcpInboxAnswerInput): boolean
  cancelAll(): void
}

/**
 * Shared parked ACP ask gates (BL-192 / BL-195).
 * Inbox answers resolve here; ACP session handlers call `ask`.
 * `append` must notify the inbox projection (EventLog / host).
 */
export function createAcpAsks(deps: {
  append: (event: EngineEvent) => void
  clock?: Clock
}): AcpAsks {
  const clock = deps.clock ?? systemClock
  const append = deps.append

  const gates: AcpInboxGates = {
    permission: createPermissionAskGate({
      clock,
      onRequested: (event) => {
        append(event)
      },
      onAutoReject: (input) => {
        gates.permission.answer(input.itemId, "reject-once")
        append({
          type: "permission_answered",
          runId: input.runId,
          at: input.at,
          nodeId: input.nodeId,
          pass: input.pass,
          requestId: input.requestId,
          optionId: "reject-once",
        })
      },
    }),
    question: createQuestionAskGate({
      clock,
      onRequested: (event) => {
        append(event)
      },
    }),
    planReview: createPlanReviewGate({
      clock,
      onRequested: (event) => {
        append(event)
      },
    }),
  }

  return {
    gates,
    answer(input: AcpInboxAnswerInput): boolean {
      if (!answerParkedAcpAsk(gates, input)) return false
      append(acpAnsweredEvent(input))
      return true
    },
    cancelAll(): void {
      gates.permission.cancelAll()
      gates.question.cancelAll()
      gates.planReview.cancelAll()
    },
  }
}

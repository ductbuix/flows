import {
  acpAnsweredEvent,
  answerParkedAcpAsk,
  createPermissionAskGate,
  createPlanReviewGate,
  createQuestionAskGate,
  type AcpInboxAnswerInput,
  type AcpInboxGates,
  type Clock,
} from "@workspace/core"
import type { EventLog } from "./event-log.ts"

const systemClock: Clock = { now: () => Date.now() }

/**
 * Shared parked ACP ask gates for the daemon (BL-192).
 * Inbox answers resolve here; ACP session handlers call `ask`.
 */
export function createEngineAcpAsks(log: EventLog): EngineAcpAsks {
  const append = (event: Parameters<EventLog["append"]>[0]) => {
    log.append(event)
  }

  const gates: AcpInboxGates = {
    permission: createPermissionAskGate({
      clock: systemClock,
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
      clock: systemClock,
      onRequested: (event) => {
        append(event)
      },
    }),
    planReview: createPlanReviewGate({
      clock: systemClock,
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

export type EngineAcpAsks = {
  gates: AcpInboxGates
  answer(input: AcpInboxAnswerInput): boolean
  cancelAll(): void
}

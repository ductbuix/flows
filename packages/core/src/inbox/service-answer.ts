import {
  inboxApprovalOptionIdSchema,
  inboxPermissionOptionIdSchema,
  inboxPlanReviewOptionIdSchema,
  inboxQuestionOptionIdSchema,
  type CursorAskAnswer,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import { validateAskAnswers } from "../agents/question-ask.ts"
import type { InboxDecision, InboxItem } from "./projection.ts"

type Route = (
  item: Exclude<InboxItem, { kind: "sign_in" }>,
  optionId: InboxDecision,
  answers?: CursorAskAnswer[]
) => Promise<void>

/** Parse and route an inbox/answer for one open item. */
export async function answerInboxItem(
  item: InboxItem,
  optionId: string,
  answers: readonly CursorAskAnswer[] | undefined,
  route: Route
): Promise<void> {
  if (item.kind === "sign_in") {
    throw engineError(
      "failed_precondition",
      "Sign-in items resolve when the connector is connected"
    )
  }
  if (item.kind === "approval") {
    const parsed = inboxApprovalOptionIdSchema.safeParse(optionId)
    if (!parsed.success) {
      throw engineError(
        "invalid_params",
        `Unknown optionId for approval: ${optionId}`
      )
    }
    await route(item, parsed.data)
    return
  }
  if (item.kind === "question") {
    const parsed = inboxQuestionOptionIdSchema.safeParse(optionId)
    if (!parsed.success) {
      throw engineError(
        "invalid_params",
        `Unknown optionId for question: ${optionId}`
      )
    }
    if (parsed.data === "answered") {
      if (!answers || !validateAskAnswers(item.questions, answers)) {
        throw engineError(
          "invalid_params",
          "Invalid or incomplete answers for question"
        )
      }
      await route(item, parsed.data, [...answers])
      return
    }
    await route(item, parsed.data)
    return
  }
  if (item.kind === "plan_review") {
    const parsed = inboxPlanReviewOptionIdSchema.safeParse(optionId)
    if (!parsed.success) {
      throw engineError(
        "invalid_params",
        `Unknown optionId for plan_review: ${optionId}`
      )
    }
    await route(item, parsed.data)
    return
  }
  const parsed = inboxPermissionOptionIdSchema.safeParse(optionId)
  if (!parsed.success) {
    throw engineError(
      "invalid_params",
      `Unknown optionId for permission: ${optionId}`
    )
  }
  await route(item, parsed.data)
}

/** Dismiss maps to a reject/skip option so the run does not stay parked. */
export function dismissOptionId(
  item: Exclude<InboxItem, { kind: "sign_in" }>
): InboxDecision {
  if (item.kind === "approval" || item.kind === "plan_review") return "rejected"
  if (item.kind === "question") return "skipped"
  return "reject-once"
}

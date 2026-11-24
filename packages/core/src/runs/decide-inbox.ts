import type { DecideOutput, RunState } from "./model.ts"
import { latestStep } from "./model.ts"

/** Resume a step waiting on an agent permission Inbox item (BL-146). */
export function decidePermissionAnswer(
  state: RunState,
  input: {
    at: string
    nodeId: string
    pass: number
    requestId: string
    optionId: "allow-once" | "allow-always" | "reject-once"
  }
): DecideOutput {
  const step = latestStep(state.steps, input.nodeId)
  if (
    !step ||
    step.pass !== input.pass ||
    step.status !== "waiting" ||
    step.waitingKind !== "permission"
  ) {
    return { events: [], effects: [] }
  }
  return {
    events: [
      {
        type: "permission_answered",
        runId: state.runId,
        at: input.at,
        nodeId: input.nodeId,
        pass: input.pass,
        requestId: input.requestId,
        optionId: input.optionId,
      },
    ],
    effects: [],
  }
}

/** Resume a step waiting on a Cursor ask_question Inbox item (BL-147). */
export function decideQuestionAnswer(
  state: RunState,
  input: {
    at: string
    nodeId: string
    pass: number
    requestId: string
    outcome: "answered" | "skipped"
    answers?: readonly {
      questionId: string
      selectedOptionIds: string[]
    }[]
    reason?: string
  }
): DecideOutput {
  const step = latestStep(state.steps, input.nodeId)
  if (
    !step ||
    step.pass !== input.pass ||
    step.status !== "waiting" ||
    step.waitingKind !== "question"
  ) {
    return { events: [], effects: [] }
  }
  return {
    events: [
      {
        type: "question_answered",
        runId: state.runId,
        at: input.at,
        nodeId: input.nodeId,
        pass: input.pass,
        requestId: input.requestId,
        outcome: input.outcome,
        ...(input.answers ? { answers: [...input.answers] } : {}),
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      },
    ],
    effects: [],
  }
}

/** Resume a step waiting on a Cursor create_plan Inbox item (BL-148). */
export function decidePlanReviewAnswer(
  state: RunState,
  input: {
    at: string
    nodeId: string
    pass: number
    requestId: string
    outcome: "accepted" | "rejected"
    reason?: string
  }
): DecideOutput {
  const step = latestStep(state.steps, input.nodeId)
  if (
    !step ||
    step.pass !== input.pass ||
    step.status !== "waiting" ||
    step.waitingKind !== "plan_review"
  ) {
    return { events: [], effects: [] }
  }
  return {
    events: [
      {
        type: "plan_review_answered",
        runId: state.runId,
        at: input.at,
        nodeId: input.nodeId,
        pass: input.pass,
        requestId: input.requestId,
        outcome: input.outcome,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      },
    ],
    effects: [],
  }
}

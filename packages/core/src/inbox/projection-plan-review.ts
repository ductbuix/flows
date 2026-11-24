import type { EngineEvent } from "@workspace/contracts"
import type {
  InboxChange,
  InboxItem,
  InboxProjectionState,
} from "./projection.ts"

export function planReviewItemId(
  runId: string,
  nodeId: string,
  pass: number,
  requestId: string
): string {
  return `plan_review:${runId}:${nodeId}:${pass}:${requestId}`
}

function displayQuestion(
  event: Extract<EngineEvent, { type: "plan_review_requested" }>
): string {
  if (event.name) return event.name
  if (event.overview) return event.overview
  const firstLine = event.plan.split("\n").find((line) => line.trim())
  return firstLine?.trim() || "Review plan"
}

export function addPlanReview(
  state: InboxProjectionState,
  event: Extract<EngineEvent, { type: "plan_review_requested" }>
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = planReviewItemId(
    event.runId,
    event.nodeId,
    event.pass,
    event.requestId
  )
  const existing = state.items.get(id)
  if (existing?.status === "open") return { state, changes: [] }

  const workflowId = state.workflowByRun.get(event.runId)
  const item: InboxItem = {
    id,
    kind: "plan_review",
    runId: event.runId,
    ...(workflowId ? { workflowId } : {}),
    nodeId: event.nodeId,
    pass: event.pass,
    requestId: event.requestId,
    ...(event.name !== undefined ? { name: event.name } : {}),
    ...(event.overview !== undefined ? { overview: event.overview } : {}),
    plan: event.plan,
    todos: event.todos,
    question: displayQuestion(event),
    at: event.at,
    status: "open",
  }
  const items = new Map(state.items)
  items.set(id, item)
  return {
    state: { ...state, items },
    changes: [{ kind: "item_added", item }],
  }
}

export function resolvePlanReview(
  state: InboxProjectionState,
  event: Extract<EngineEvent, { type: "plan_review_answered" }>
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = planReviewItemId(
    event.runId,
    event.nodeId,
    event.pass,
    event.requestId
  )
  const cur = state.items.get(id)
  if (!cur || cur.status !== "open" || cur.kind !== "plan_review") {
    return { state, changes: [] }
  }
  const item: InboxItem = {
    ...cur,
    status: "resolved",
    decision: event.outcome,
  }
  const items = new Map(state.items)
  items.set(id, item)
  return {
    state: { ...state, items },
    changes: [
      {
        kind: "item_resolved",
        itemId: id,
        decision: event.outcome,
      },
    ],
  }
}

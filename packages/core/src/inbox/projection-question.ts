import type { EngineEvent } from "@workspace/contracts"
import type {
  InboxChange,
  InboxItem,
  InboxProjectionState,
} from "./projection.ts"

export function questionItemId(
  runId: string,
  nodeId: string,
  pass: number,
  requestId: string
): string {
  return `question:${runId}:${nodeId}:${pass}:${requestId}`
}

function displayQuestion(
  event: Extract<EngineEvent, { type: "question_asked" }>
): string {
  if (event.title) return event.title
  return event.questions.map((q) => q.prompt).join(" · ")
}

export function addQuestion(
  state: InboxProjectionState,
  event: Extract<EngineEvent, { type: "question_asked" }>
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = questionItemId(
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
    kind: "question",
    runId: event.runId,
    ...(workflowId ? { workflowId } : {}),
    nodeId: event.nodeId,
    pass: event.pass,
    requestId: event.requestId,
    ...(event.title !== undefined ? { title: event.title } : {}),
    questions: event.questions,
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

export function resolveQuestion(
  state: InboxProjectionState,
  event: Extract<EngineEvent, { type: "question_answered" }>
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = questionItemId(
    event.runId,
    event.nodeId,
    event.pass,
    event.requestId
  )
  const cur = state.items.get(id)
  if (!cur || cur.status !== "open" || cur.kind !== "question") {
    return { state, changes: [] }
  }
  const item: InboxItem = {
    ...cur,
    status: "resolved",
    decision: event.outcome,
    ...(event.answers ? { answers: event.answers } : {}),
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

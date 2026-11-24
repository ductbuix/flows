import type { EngineEvent } from "@workspace/contracts"
import type {
  InboxChange,
  InboxItem,
  InboxProjectionState,
} from "./projection.ts"

export function permissionItemId(
  runId: string,
  nodeId: string,
  pass: number,
  requestId: string
): string {
  return `permission:${runId}:${nodeId}:${pass}:${requestId}`
}

export function addPermission(
  state: InboxProjectionState,
  event: Extract<EngineEvent, { type: "permission_requested" }>
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = permissionItemId(
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
    kind: "permission",
    runId: event.runId,
    ...(workflowId ? { workflowId } : {}),
    nodeId: event.nodeId,
    pass: event.pass,
    tool: event.tool,
    requestId: event.requestId,
    question: event.question ?? event.tool,
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

export function resolvePermission(
  state: InboxProjectionState,
  event: Extract<EngineEvent, { type: "permission_answered" }>,
  resolveItem: (
    state: InboxProjectionState,
    id: string,
    decision: InboxItem["decision"] | undefined
  ) => { state: InboxProjectionState; changes: InboxChange[] }
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = permissionItemId(
    event.runId,
    event.nodeId,
    event.pass,
    event.requestId
  )
  return resolveItem(state, id, event.optionId)
}

import type { EngineEvent, WireInboxItem } from "@workspace/contracts"
import type { StoredEvent } from "../ports/event-store.ts"

export type InboxItem = WireInboxItem

export type InboxProjectionState = {
  readonly items: ReadonlyMap<string, InboxItem>
  readonly workflowByRun: ReadonlyMap<string, string>
}

export type InboxChange =
  | { kind: "item_added"; item: InboxItem }
  | {
      kind: "item_resolved"
      itemId: string
      decision?: "approved" | "rejected"
    }

export function emptyInboxProjection(): InboxProjectionState {
  return { items: new Map(), workflowByRun: new Map() }
}

/** Stable id so rebuild from the same events yields the same items. */
export function approvalItemId(
  runId: string,
  nodeId: string,
  pass: number
): string {
  return `approval:${runId}:${nodeId}:${pass}`
}

export function foldInboxEvent(
  state: InboxProjectionState,
  event: EngineEvent
): { state: InboxProjectionState; changes: InboxChange[] } {
  switch (event.type) {
    case "run_started": {
      const workflowByRun = new Map(state.workflowByRun)
      workflowByRun.set(event.runId, event.workflowId)
      return { state: { ...state, workflowByRun }, changes: [] }
    }
    case "approval_requested":
      return addApproval(state, event)
    case "step_approved":
      return resolveApproval(state, event, "approved")
    case "step_rejected":
      return resolveApproval(state, event, "rejected")
    case "step_cancelled":
      return resolveApproval(state, event, undefined)
    case "run_deleted":
      return resolveAllForRun(state, event.runId)
    default:
      return { state, changes: [] }
  }
}

export function foldInboxStored(
  state: InboxProjectionState,
  stored: StoredEvent
): { state: InboxProjectionState; changes: InboxChange[] } {
  return foldInboxEvent(state, stored.event)
}

/** Rebuild open+resolved items from an event list (silent; no updates). */
export function projectInbox(
  events: readonly StoredEvent[]
): InboxProjectionState {
  let state = emptyInboxProjection()
  for (const stored of events) {
    state = foldInboxStored(state, stored).state
  }
  return state
}

export function openInboxItems(state: InboxProjectionState): InboxItem[] {
  return [...state.items.values()]
    .filter((item) => item.status === "open")
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
}

function addApproval(
  state: InboxProjectionState,
  event: Extract<EngineEvent, { type: "approval_requested" }>
): { state: InboxProjectionState; changes: InboxChange[] } {
  const nodeId = event.nodeId ?? event.taskId
  const pass = event.pass ?? 1
  const id = approvalItemId(event.runId, nodeId, pass)
  const existing = state.items.get(id)
  if (existing?.status === "open") return { state, changes: [] }

  const workflowId = state.workflowByRun.get(event.runId)
  const item: InboxItem = {
    id,
    kind: "approval",
    runId: event.runId,
    ...(workflowId ? { workflowId } : {}),
    nodeId,
    pass,
    question: event.question ?? "Approve?",
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

function resolveApproval(
  state: InboxProjectionState,
  event: {
    runId: string
    nodeId: string
    pass: number
  },
  decision: "approved" | "rejected" | undefined
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = approvalItemId(event.runId, event.nodeId, event.pass)
  const cur = state.items.get(id)
  if (!cur || cur.status !== "open") return { state, changes: [] }
  const item: InboxItem = {
    ...cur,
    status: "resolved",
    ...(decision ? { decision } : {}),
  }
  const items = new Map(state.items)
  items.set(id, item)
  return {
    state: { ...state, items },
    changes: [
      {
        kind: "item_resolved",
        itemId: id,
        ...(decision ? { decision } : {}),
      },
    ],
  }
}

function resolveAllForRun(
  state: InboxProjectionState,
  runId: string
): { state: InboxProjectionState; changes: InboxChange[] } {
  let next = state
  const changes: InboxChange[] = []
  for (const item of state.items.values()) {
    if (item.runId !== runId || item.status !== "open") continue
    const folded = resolveApproval(
      next,
      { runId: item.runId, nodeId: item.nodeId, pass: item.pass },
      undefined
    )
    next = folded.state
    changes.push(...folded.changes)
  }
  return { state: next, changes }
}

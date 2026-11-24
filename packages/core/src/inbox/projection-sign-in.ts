import type { ConnectorStatus } from "@workspace/contracts"
import type {
  InboxChange,
  InboxItem,
  InboxProjectionState,
} from "./projection.ts"

export function signInItemId(connectorId: string): string {
  return `sign_in:${connectorId}`
}

export type SignInStatusInput = {
  connectorId: string
  name: string
  status: ConnectorStatus
  at: string
}

/**
 * `expired` opens a sign-in item; `connected` (or `off`) resolves it (BL-164).
 */
export function applySignInStatus(
  state: InboxProjectionState,
  input: SignInStatusInput
): { state: InboxProjectionState; changes: InboxChange[] } {
  if (input.status === "expired") {
    return addSignIn(state, input)
  }
  return resolveSignIn(state, input.connectorId)
}

function addSignIn(
  state: InboxProjectionState,
  input: SignInStatusInput
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = signInItemId(input.connectorId)
  const existing = state.items.get(id)
  if (existing?.status === "open") return { state, changes: [] }

  const item: InboxItem = {
    id,
    kind: "sign_in",
    connectorId: input.connectorId,
    question: `${input.name} sign-in expired`,
    at: input.at,
    status: "open",
  }
  const items = new Map(state.items)
  items.set(id, item)
  return {
    state: { ...state, items },
    changes: [{ kind: "item_added", item }],
  }
}

function resolveSignIn(
  state: InboxProjectionState,
  connectorId: string
): { state: InboxProjectionState; changes: InboxChange[] } {
  const id = signInItemId(connectorId)
  const cur = state.items.get(id)
  if (!cur || cur.status !== "open" || cur.kind !== "sign_in") {
    return { state, changes: [] }
  }
  const item: InboxItem = { ...cur, status: "resolved" }
  const items = new Map(state.items)
  items.set(id, item)
  return {
    state: { ...state, items },
    changes: [{ kind: "item_resolved", itemId: id }],
  }
}

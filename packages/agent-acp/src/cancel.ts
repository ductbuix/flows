/** Default wait after `session/cancel` before killing the process group. */
export const DEFAULT_CANCEL_GRACE_MS = 5_000

/** ACP `session/request_permission` cancelled outcome (DES-041). */
export const CANCELLED_PERMISSION_RESULT = {
  outcome: { outcome: "cancelled" as const },
}

/** Cursor `cursor/ask_question` cancelled outcome (DES-041 / BL-147). */
export const CANCELLED_ASK_QUESTION_RESULT = {
  outcome: { outcome: "cancelled" as const },
}

/** Cursor `cursor/create_plan` cancelled outcome (DES-041 / BL-148). */
export const CANCELLED_CREATE_PLAN_RESULT = {
  outcome: { outcome: "cancelled" as const },
}

export type PendingClientRequest = {
  resolve: (result: unknown) => void
  cancelledResult: unknown
}

/** @deprecated Prefer PendingClientRequest. */
export type PendingPermission = PendingClientRequest

/** Answer every parked client request with its cancelled outcome. */
export function cancelPendingRequests(
  pending: Set<PendingClientRequest>
): void {
  for (const entry of pending) {
    entry.resolve(entry.cancelledResult)
  }
  pending.clear()
}

/** Answer every parked permission with the cancelled outcome. */
export function cancelPendingPermissions(
  pending: Set<PendingClientRequest>
): void {
  cancelPendingRequests(pending)
}

/**
 * After `session/cancel`, wait `graceMs` then call `kill` if `isDone` is
 * still false. Returns a clear function.
 */
export function scheduleCancelKill(
  graceMs: number,
  isDone: () => boolean,
  kill: (() => void) | undefined
): () => void {
  if (!kill || graceMs <= 0) return () => {}
  const timer = setTimeout(() => {
    if (!isDone()) kill()
  }, graceMs)
  return () => clearTimeout(timer)
}

/** Default wait after `session/cancel` before killing the process group. */
export const DEFAULT_CANCEL_GRACE_MS = 5_000

/** ACP `session/request_permission` cancelled outcome (DES-041). */
export const CANCELLED_PERMISSION_RESULT = {
  outcome: { outcome: "cancelled" as const },
}

export type PendingPermission = {
  resolve: (result: unknown) => void
}

/** Answer every parked permission with the cancelled outcome. */
export function cancelPendingPermissions(
  pending: Set<PendingPermission>
): void {
  for (const entry of pending) {
    entry.resolve(CANCELLED_PERMISSION_RESULT)
  }
  pending.clear()
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

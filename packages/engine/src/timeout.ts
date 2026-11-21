import type { Task, Workflow } from "@workspace/shared"

/** Builtin default when neither task nor workflow sets timeout (DES-019). */
export const DEFAULT_ATTEMPT_TIMEOUT_SECONDS = 900

/**
 * Resolve attempt timeout: task → workflow → 900 seconds.
 */
export function resolveAttemptTimeout(
  task: Pick<Task, "timeout">,
  workflow: Pick<Workflow, "timeout">
): number {
  return task.timeout ?? workflow.timeout ?? DEFAULT_ATTEMPT_TIMEOUT_SECONDS
}

/**
 * Remaining milliseconds until the attempt deadline.
 * Negative when already overdue.
 */
export function remainingTimeoutMs(
  startedAtIso: string,
  timeoutSeconds: number,
  nowMs: number = Date.now()
): number {
  const started = Date.parse(startedAtIso)
  if (Number.isNaN(started)) return timeoutSeconds * 1000
  return started + timeoutSeconds * 1000 - nowMs
}

import type { EngineEvent } from "@workspace/shared"
import type { RunState, TaskState } from "./fold.ts"

function now(): string {
  return new Date().toISOString()
}

/** True when the UI may request a manual retry (DES-011). */
export function canManualRetry(task: TaskState | undefined): boolean {
  if (!task) return false
  if (task.status === "failed") return true
  const last = task.attempts.at(-1)
  return Boolean(last?.interrupted)
}

/**
 * Append task_retry_requested after validating the task. Caller reopens
 * the scheduler when the run was settled.
 */
export function requestManualRetry(
  runId: string,
  taskId: string,
  state: RunState,
  append: (event: EngineEvent) => void
): void {
  if (state.deleted) throw new Error(`run ${runId} is deleted`)
  const task = state.tasks[taskId]
  if (!canManualRetry(task)) {
    throw new Error(`task ${taskId} cannot be retried`)
  }
  append({
    type: "task_retry_requested",
    runId,
    taskId,
    at: now(),
  })
}

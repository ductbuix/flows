import type { EngineEvent } from "@workspace/shared"
import { isUnfinishedTask, type RunState } from "./fold.ts"

function now(): string {
  return new Date().toISOString()
}

/**
 * Cancel a queued run without a scheduler (DES-021).
 * Appends cancel_requested, cancels unfinished tasks, then run_cancelled.
 */
export function cancelQueuedRun(
  state: RunState,
  append: (event: EngineEvent) => void
): void {
  if (state.status !== "queued") return
  if (!state.cancelRequested) {
    append({
      type: "cancel_requested",
      runId: state.runId,
      at: now(),
    })
  }
  for (const task of Object.values(state.tasks)) {
    if (!isUnfinishedTask(task.status)) continue
    append({
      type: "task_cancelled",
      runId: state.runId,
      taskId: task.id,
      at: now(),
    })
  }
  append({
    type: "run_cancelled",
    runId: state.runId,
    at: now(),
  })
}

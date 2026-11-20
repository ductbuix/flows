import { needTaskId } from "@workspace/shared"
import type { RunState, TaskState } from "./fold.ts"

/** Transitive dependants of taskId (tasks that need it, directly or not). */
export function dependantIds(state: RunState, taskId: string): string[] {
  const out: string[] = []
  const queue = [taskId]
  const seen = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const task of state.graph.tasks) {
      if (seen.has(task.id)) continue
      const needs = task.needs ?? []
      if (!needs.some((n) => needTaskId(n) === id)) continue
      seen.add(task.id)
      out.push(task.id)
      queue.push(task.id)
    }
  }
  return out
}

export function resetForRetry(task: TaskState, manual: boolean): void {
  task.status = "pending"
  delete task.failReason
  delete task.skipReason
  if (manual) task.manualRetryPending = true
  else delete task.manualRetryPending
}

/** Apply task_retry_requested: reopen run, reset task and dependants. */
export function applyTaskRetryRequested(
  state: RunState,
  taskId: string
): RunState {
  const task = state.tasks[taskId]
  if (!task) return state
  state.status = "running"
  state.cancelRequested = false
  resetForRetry(task, true)
  for (const depId of dependantIds(state, taskId)) {
    const dep = state.tasks[depId]
    if (dep) resetForRetry(dep, false)
  }
  return state
}

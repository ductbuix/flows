import type { EngineEvent } from "@workspace/shared"
import { isUnfinishedTask, openAttempts, type RunState } from "./fold.ts"
import { killProcessGroup } from "./pid.ts"
import { portLeaseKey, portLeases } from "./port-lease.ts"
import { serialLocks } from "./serial-lock.ts"

function now(): string {
  return new Date().toISOString()
}

export type CancelHost = {
  runId: string
  state: () => RunState
  append: (event: EngineEvent) => void
  finish: (state: RunState) => void
}

/**
 * Append cancel_requested, end process groups, then cancel unfinished
 * tasks and the run (DES-003 / DES-011).
 */
export function cancelRun(host: CancelHost): void {
  const state = host.state()
  if (state.status !== "running") return

  if (!state.cancelRequested) {
    host.append({
      type: "cancel_requested",
      runId: host.runId,
      at: now(),
    })
    for (const { taskId, attempt } of openAttempts(state)) {
      if (attempt.pid !== undefined) killProcessGroup(attempt.pid)
      portLeases.release(portLeaseKey(host.runId, taskId, attempt.attempt))
      serialLocks.release(host.runId, taskId, attempt.attempt)
    }
  }

  finishCancel(host)
}

/** Complete cancel after cancel_requested (also used on resume). */
export function finishCancel(host: CancelHost): void {
  const state = host.state()
  for (const task of Object.values(state.tasks)) {
    if (!isUnfinishedTask(task.status)) continue
    host.append({
      type: "task_cancelled",
      runId: host.runId,
      taskId: task.id,
      at: now(),
    })
  }
  if (host.state().status === "running") {
    host.append({
      type: "run_cancelled",
      runId: host.runId,
      at: now(),
    })
  }
  host.finish(host.state())
}

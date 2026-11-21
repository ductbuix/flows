import { isAgentTask, type EngineEvent } from "@workspace/shared"
import {
  appendFinished,
  watchKey,
  watchPid,
  type AttemptWatchHost,
} from "./attempt-watch.ts"
import { readAttemptStderr, resolveFinishReason } from "./failure-reason.ts"
import { openAttempts } from "./fold.ts"
import { isPidAlive, killProcessGroup, readExitCode } from "./pid.ts"
import { DEFAULT_PORT_COUNT, portLeaseKey, portLeases } from "./port-lease.ts"
import { remainingTimeoutMs } from "./timeout.ts"

function now(): string {
  return new Date().toISOString()
}

/**
 * For each open attempt: re-attach by pid if alive (with remaining
 * timeout), else finish from exit.code or record interrupted
 * (DES-003 / BL-005 / DES-019).
 */
export function resumeOpenAttempts(
  host: AttemptWatchHost,
  append: (event: EngineEvent) => void
): void {
  const state = host.state()
  if (state.status !== "running") return

  for (const { taskId, attempt } of openAttempts(state)) {
    const n = attempt.attempt
    if (host.watching.has(watchKey(taskId, n))) continue

    const timeout = attempt.timeout
    const startedAt = attempt.startedAt
    const overdue =
      timeout !== undefined &&
      startedAt !== undefined &&
      remainingTimeoutMs(startedAt, timeout) <= 0

    const leaseKey = portLeaseKey(host.runId, taskId, n)

    if (attempt.pid !== undefined && isPidAlive(attempt.pid)) {
      if (overdue) {
        killProcessGroup(attempt.pid)
        finishTimedOut(host, taskId, n)
        continue
      }
      if (attempt.portBase !== undefined) {
        portLeases.rehold(leaseKey, {
          base: attempt.portBase,
          count: attempt.portCount ?? DEFAULT_PORT_COUNT,
        })
      }
      watchPid(
        host,
        taskId,
        n,
        attempt.pid,
        timeout !== undefined && startedAt !== undefined
          ? { timeoutSeconds: timeout, startedAt }
          : undefined
      )
      continue
    }

    // Dead attempt: ports are free after resume (fresh process memory).
    portLeases.release(leaseKey)

    const code = readExitCode(host.runRoot, taskId, n)
    if (code !== null) {
      const task = state.graph.tasks.find((t) => t.id === taskId)
      const reason = resolveFinishReason({
        stderr: readAttemptStderr(host.runRoot, taskId, n),
        cli: task && isAgentTask(task) ? task.cli : undefined,
        timedOut: overdue,
      })
      append({
        type: "attempt_finished",
        runId: host.runId,
        taskId,
        attempt: n,
        exitCode: code,
        ...(reason !== undefined ? { reason } : {}),
        at: now(),
      })
    } else if (overdue) {
      finishTimedOut(host, taskId, n)
    } else {
      append({
        type: "attempt_interrupted",
        runId: host.runId,
        taskId,
        attempt: n,
        at: now(),
      })
    }
  }
}

function finishTimedOut(
  host: AttemptWatchHost,
  taskId: string,
  attempt: number
): void {
  const code = readExitCode(host.runRoot, taskId, attempt) ?? 1
  const task = host.state().graph.tasks.find((t) => t.id === taskId)
  const reason = resolveFinishReason({
    stderr: readAttemptStderr(host.runRoot, taskId, attempt),
    cli: task && isAgentTask(task) ? task.cli : undefined,
    timedOut: true,
  })
  appendFinished(host, taskId, attempt, code, reason)
}

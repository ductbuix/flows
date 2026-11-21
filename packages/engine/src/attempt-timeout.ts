import { isAgentTask, type EngineEvent } from "@workspace/shared"
import {
  readAttemptStderr,
  resolveFinishReason,
  type CliKind,
} from "./failure-reason.ts"
import { openAttempts, type RunState } from "./fold.ts"
import { killProcessGroup, readExitCode } from "./pid.ts"
import { portLeaseKey, portLeases } from "./port-lease.ts"
import { remainingTimeoutMs } from "./timeout.ts"

export type TimeoutWatchHost = {
  runId: string
  runRoot: string
  state: () => RunState
  append: (event: EngineEvent) => void
  requestTick: () => void
}

function now(): string {
  return new Date().toISOString()
}

function taskCli(state: RunState, taskId: string): CliKind | undefined {
  const task = state.graph.tasks.find((t) => t.id === taskId)
  return task && isAgentTask(task) ? task.cli : undefined
}

export function appendFinished(
  host: TimeoutWatchHost,
  taskId: string,
  attempt: number,
  exitCode: number,
  reason?: string
): void {
  const open = openAttempts(host.state()).some(
    (a) => a.taskId === taskId && a.attempt.attempt === attempt
  )
  if (!open) return

  host.append({
    type: "attempt_finished",
    runId: host.runId,
    taskId,
    attempt,
    exitCode,
    ...(reason !== undefined ? { reason } : {}),
    at: now(),
  })
  portLeases.release(portLeaseKey(host.runId, taskId, attempt))
  host.requestTick()
}

export function finishWithMappedReason(
  host: TimeoutWatchHost,
  taskId: string,
  attempt: number,
  exitCode: number,
  timedOut: boolean
): void {
  const reason = resolveFinishReason({
    stderr: readAttemptStderr(host.runRoot, taskId, attempt),
    cli: taskCli(host.state(), taskId),
    timedOut,
  })
  appendFinished(host, taskId, attempt, exitCode, reason)
}

export type WatchTimer = { clear: () => void }

/** Schedule process-group kill when the attempt deadline is reached. */
export function armTimeout(
  host: TimeoutWatchHost,
  taskId: string,
  attempt: number,
  pid: number | undefined,
  timeoutSeconds: number,
  startedAt: string,
  onFire: () => void
): WatchTimer {
  const remaining = remainingTimeoutMs(startedAt, timeoutSeconds)
  if (remaining <= 0) {
    if (pid !== undefined) killProcessGroup(pid)
    onFire()
    return { clear: () => undefined }
  }
  const handle = setTimeout(() => {
    if (pid !== undefined) killProcessGroup(pid)
    onFire()
  }, remaining)
  return { clear: () => clearTimeout(handle) }
}

export function openAttemptMeta(
  host: TimeoutWatchHost,
  taskId: string,
  attempt: number
): { timeout?: number; startedAt?: string; pid?: number } | undefined {
  return openAttempts(host.state()).find(
    (a) => a.taskId === taskId && a.attempt.attempt === attempt
  )?.attempt
}

export function settleOnTimeout(
  host: TimeoutWatchHost,
  taskId: string,
  attempt: number,
  settle: (exitCode: number) => void
): void {
  const code = readExitCode(host.runRoot, taskId, attempt)
  settle(code ?? 1)
}

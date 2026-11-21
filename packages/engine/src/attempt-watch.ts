import type { ChildProcess } from "node:child_process"
import type { EngineEvent } from "@workspace/shared"
import {
  appendFinished,
  armTimeout,
  finishWithMappedReason,
  openAttemptMeta,
  settleOnTimeout,
  type WatchTimer,
} from "./attempt-timeout.ts"
import type { RunState } from "./fold.ts"
import { readExitCode, waitForPid } from "./pid.ts"
import { waitForExit } from "./runner.ts"

export type AttemptWatchHost = {
  runId: string
  runRoot: string
  watching: Set<string>
  state: () => RunState
  append: (event: EngineEvent) => void
  requestTick: () => void
}

export { appendFinished }

function now(): string {
  return new Date().toISOString()
}

export function watchKey(taskId: string, attempt: number): string {
  return `${taskId}:${attempt}`
}

export function watchChild(
  host: AttemptWatchHost,
  taskId: string,
  attempt: number,
  child: ChildProcess,
  opts?: { timeoutSeconds: number; startedAt: string }
): void {
  const key = watchKey(taskId, attempt)
  if (host.watching.has(key)) return
  host.watching.add(key)

  let timedOut = false
  let settled = false
  let timer: WatchTimer = { clear: () => undefined }
  const settle = (exitCode: number) => {
    if (settled) return
    settled = true
    timer.clear()
    finishWithMappedReason(host, taskId, attempt, exitCode, timedOut)
  }

  const meta = openAttemptMeta(host, taskId, attempt)
  const timeoutSeconds = opts?.timeoutSeconds ?? meta?.timeout
  const startedAt = opts?.startedAt ?? meta?.startedAt
  const pid = child.pid ?? meta?.pid

  if (timeoutSeconds !== undefined && startedAt !== undefined) {
    timer = armTimeout(
      host,
      taskId,
      attempt,
      pid,
      timeoutSeconds,
      startedAt,
      () => {
        timedOut = true
        settleOnTimeout(host, taskId, attempt, settle)
      }
    )
  }

  void waitForExit(child)
    .then((exitCode) => {
      settle(exitCode)
    })
    .catch(() => {
      settle(1)
    })
}

export function watchPid(
  host: AttemptWatchHost,
  taskId: string,
  attempt: number,
  pid: number,
  opts?: { timeoutSeconds: number; startedAt: string }
): void {
  const key = watchKey(taskId, attempt)
  if (host.watching.has(key)) return
  host.watching.add(key)

  let timedOut = false
  let settled = false
  let timer: WatchTimer = { clear: () => undefined }
  const settleFinished = (exitCode: number) => {
    if (settled) return
    settled = true
    timer.clear()
    finishWithMappedReason(host, taskId, attempt, exitCode, timedOut)
  }
  const settleInterrupted = () => {
    if (settled) return
    settled = true
    timer.clear()
    host.append({
      type: "attempt_interrupted",
      runId: host.runId,
      taskId,
      attempt,
      at: now(),
    })
    host.requestTick()
  }

  const meta = openAttemptMeta(host, taskId, attempt)
  const timeoutSeconds = opts?.timeoutSeconds ?? meta?.timeout
  const startedAt = opts?.startedAt ?? meta?.startedAt

  if (timeoutSeconds !== undefined && startedAt !== undefined) {
    timer = armTimeout(
      host,
      taskId,
      attempt,
      pid,
      timeoutSeconds,
      startedAt,
      () => {
        timedOut = true
        settleOnTimeout(host, taskId, attempt, settleFinished)
      }
    )
  }

  void waitForPid(pid).then(() => {
    const code = readExitCode(host.runRoot, taskId, attempt)
    if (code !== null) {
      settleFinished(code)
      return
    }
    if (timedOut) {
      settleFinished(1)
      return
    }
    settleInterrupted()
  })
}

import type { ChildProcess } from "node:child_process"
import type { EngineEvent } from "@workspace/shared"
import { openAttempts, type RunState } from "./fold.ts"
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

function now(): string {
  return new Date().toISOString()
}

export function watchKey(taskId: string, attempt: number): string {
  return `${taskId}:${attempt}`
}

export function appendFinished(
  host: AttemptWatchHost,
  taskId: string,
  attempt: number,
  exitCode: number
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
    at: now(),
  })
  host.requestTick()
}

export function watchChild(
  host: AttemptWatchHost,
  taskId: string,
  attempt: number,
  child: ChildProcess
): void {
  const key = watchKey(taskId, attempt)
  if (host.watching.has(key)) return
  host.watching.add(key)

  void waitForExit(child)
    .then((exitCode) => {
      appendFinished(host, taskId, attempt, exitCode)
    })
    .catch(() => {
      appendFinished(host, taskId, attempt, 1)
    })
}

export function watchPid(
  host: AttemptWatchHost,
  taskId: string,
  attempt: number,
  pid: number
): void {
  const key = watchKey(taskId, attempt)
  if (host.watching.has(key)) return
  host.watching.add(key)

  void waitForPid(pid).then(() => {
    const code = readExitCode(host.runRoot, taskId, attempt)
    if (code !== null) {
      appendFinished(host, taskId, attempt, code)
      return
    }
    host.append({
      type: "attempt_interrupted",
      runId: host.runId,
      taskId,
      attempt,
      at: now(),
    })
    host.requestTick()
  })
}

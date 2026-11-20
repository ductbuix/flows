import type { EngineEvent } from "@workspace/shared"
import { watchKey, watchPid, type AttemptWatchHost } from "./attempt-watch.ts"
import { openAttempts } from "./fold.ts"
import { isPidAlive, readExitCode } from "./pid.ts"

function now(): string {
  return new Date().toISOString()
}

/**
 * For each open attempt: re-attach by pid if alive, else finish from
 * exit.code or record interrupted (DES-003 / BL-005).
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

    if (attempt.pid !== undefined && isPidAlive(attempt.pid)) {
      watchPid(host, taskId, n, attempt.pid)
      continue
    }

    const code = readExitCode(host.runRoot, taskId, n)
    if (code !== null) {
      append({
        type: "attempt_finished",
        runId: host.runId,
        taskId,
        attempt: n,
        exitCode: code,
        at: now(),
      })
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

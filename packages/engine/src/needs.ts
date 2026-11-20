import {
  needTaskId,
  type Need,
  type NeedObject,
  type Task,
} from "@workspace/shared"
import type { RunState, TaskState } from "./fold.ts"

export function isNeedObject(need: Need): need is NeedObject {
  return typeof need !== "string"
}

/** Upstream is finished enough for this need to be decided. */
export function needUpstreamTerminal(upstream: TaskState | undefined): boolean {
  if (!upstream) return false
  return (
    upstream.status === "succeeded" ||
    upstream.status === "failed" ||
    upstream.status === "skipped" ||
    upstream.status === "cancelled"
  )
}

/**
 * Structural readiness: every need's upstream is in a state where the
 * scheduler can launch or skip. Expr/exit `when` is decided later.
 */
export function needsStructurallyReady(task: Task, state: RunState): boolean {
  for (const need of task.needs) {
    const up = state.tasks[needTaskId(need)]
    if (!needUpstreamTerminal(up)) return false
    if (up!.status === "cancelled") return false

    if (!isNeedObject(need) || !need.when) {
      // Plain need (or object without when): require succeeded, or
      // skipped with allowSkipped.
      if (up!.status === "succeeded") continue
      if (up!.status === "skipped" && isNeedObject(need) && need.allowSkipped) {
        continue
      }
      return false
    }

    // Branch edge: terminal upstream is enough; when is evaluated next.
    if (up!.status === "skipped" && !need.allowSkipped) return false
  }
  return true
}

/** True when a pending task should be skipped due to upstream skip. */
export function shouldPropagateSkip(task: Task, state: RunState): boolean {
  for (const need of task.needs) {
    const up = state.tasks[needTaskId(need)]
    if (!up || up.status !== "skipped") continue
    const allow = isNeedObject(need) && need.allowSkipped
    if (!allow) return true
  }
  return false
}

export function latestExitCode(
  task: TaskState | undefined
): number | undefined {
  if (!task || task.attempts.length === 0) return undefined
  const last = task.attempts[task.attempts.length - 1]
  return last?.exitCode
}

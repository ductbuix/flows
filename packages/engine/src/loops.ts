import type { Condition, Task } from "@workspace/shared"
import { evaluateCondition, type ConditionContext } from "./conditions.ts"
import type { AttemptState, TaskState } from "./fold.ts"

export const DEFAULT_RETRY_MAX = 3
export const DEFAULT_REPEAT_MAX = 5

/** Overridable for tests via FLOWAPP_RETRY_BACKOFF_MS. */
export function retryBackoffMs(): number {
  return Number(process.env.FLOWAPP_RETRY_BACKOFF_MS ?? 2000)
}

export type LoopDecision =
  | { action: "succeed" }
  | { action: "fail" }
  | { action: "retry"; backoffMs: number }
  | { action: "repeat" }

function retryMax(task: Task): number {
  return task.retry?.max ?? DEFAULT_RETRY_MAX
}

function repeatMax(task: Task): number {
  return task.repeat?.max ?? DEFAULT_REPEAT_MAX
}

/** Count failed/interrupted attempts (retry budget) and successful ones. */
export function loopCounts(attempts: AttemptState[]): {
  failures: number
  successes: number
} {
  let failures = 0
  let successes = 0
  for (const a of attempts) {
    if (a.interrupted || (a.exitCode !== undefined && a.exitCode !== 0)) {
      failures += 1
    } else if (a.exitCode === 0) {
      successes += 1
    }
  }
  return { failures, successes }
}

/**
 * Decide what to do after the latest attempt closed on a looping task.
 * Caller evaluates `until` and passes `untilPassed`.
 */
export function decideLoop(
  task: Task,
  taskState: TaskState,
  untilPassed: boolean | undefined
): LoopDecision {
  const last = taskState.attempts[taskState.attempts.length - 1]
  if (!last) return { action: "fail" }

  const failed =
    last.interrupted === true ||
    (last.exitCode !== undefined && last.exitCode !== 0)

  if (failed) {
    if (!task.retry) return { action: "fail" }
    const { failures } = loopCounts(taskState.attempts)
    if (failures < retryMax(task)) {
      return {
        action: "retry",
        backoffMs: retryBackoffMs() * 2 ** (failures - 1),
      }
    }
    return { action: "fail" }
  }

  // Success (exit 0)
  if (task.repeat) {
    if (untilPassed) return { action: "succeed" }
    const { successes } = loopCounts(taskState.attempts)
    if (successes < repeatMax(task)) return { action: "repeat" }
    return { action: "fail" }
  }

  return { action: "succeed" }
}

export function untilCondition(task: Task): Condition | undefined {
  return task.repeat?.until
}

export function attemptContext(
  attemptRoot: string | undefined,
  exitCode: number | undefined,
  needExitCodes?: Record<string, number | undefined>
): ConditionContext {
  return { attemptRoot, exitCode, needExitCodes }
}

export function evalUntil(
  task: Task,
  attemptRoot: string,
  exitCode: number
): boolean {
  const until = untilCondition(task)
  if (!until) return true
  return evaluateCondition(until, attemptContext(attemptRoot, exitCode))
}

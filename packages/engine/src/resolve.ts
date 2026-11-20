import {
  isAgentTask,
  needTaskId,
  type EngineEvent,
  type Task,
  type When,
} from "@workspace/shared"
import { evaluateCondition } from "./conditions.ts"
import { hasOpenAttempts, isOpenAttempt, type RunState } from "./fold.ts"
import { decideLoop, evalUntil } from "./loops.ts"
import {
  isNeedObject,
  latestExitCode,
  needsStructurallyReady,
  shouldPropagateSkip,
} from "./needs.ts"
import { attemptDir } from "./paths.ts"

function now(): string {
  return new Date().toISOString()
}

export type ResolveHost = {
  runId: string
  runRoot: string
  state: () => RunState
  append: (event: EngineEvent) => void
  scheduleRetry: (taskId: string, backoffMs: number) => void
  launchAgain: (taskId: string) => void
}

/** Skip pending tasks for when / upstream skip / branch miss. */
export function resolveSkips(host: ResolveHost): void {
  // Re-fold after each skip so propagation sees fresh upstream status.
  for (;;) {
    const state = host.state()
    if (state.status !== "running" || state.cancelRequested) return

    let skipped = false
    for (const task of state.graph.tasks) {
      const live = state.tasks[task.id]
      if (!live || live.status !== "pending") continue

      if (shouldPropagateSkip(task, state)) {
        appendSkip(host, task.id, "upstream_skip")
        skipped = true
        break
      }

      if (!needsStructurallyReady(task, state)) continue

      if (branchWhenFails(task, state, host.runRoot)) {
        appendSkip(host, task.id, "branch")
        skipped = true
        break
      }

      if (
        task.when !== undefined &&
        !evalWhen(task.when, task, state, host.runRoot)
      ) {
        appendSkip(host, task.id, "when")
        skipped = true
        break
      }
    }
    if (!skipped) return
  }
}

function branchWhenFails(
  task: Task,
  state: RunState,
  runRoot: string
): boolean {
  for (const need of task.needs) {
    if (!isNeedObject(need) || !need.when) continue
    const up = state.tasks[need.task]
    if (!up || (up.status !== "succeeded" && up.status !== "failed")) {
      continue
    }
    const last = up.attempts[up.attempts.length - 1]
    const attemptRoot = last
      ? attemptDir(runRoot, need.task, last.attempt)
      : undefined
    if (
      !evaluateCondition(need.when, {
        exitCode: latestExitCode(up),
        attemptRoot,
      })
    ) {
      return true
    }
  }
  return false
}

function evalWhen(
  when: When,
  task: Task,
  state: RunState,
  runRoot: string
): boolean {
  if (typeof when === "boolean") return when
  const needExitCodes: Record<string, number | undefined> = {}
  for (const need of task.needs) {
    const id = needTaskId(need)
    needExitCodes[id] = latestExitCode(state.tasks[id])
  }
  let attemptRoot: string | undefined
  if (task.needs.length === 1) {
    const id = needTaskId(task.needs[0]!)
    const up = state.tasks[id]
    const last = up?.attempts[up.attempts.length - 1]
    if (last) attemptRoot = attemptDir(runRoot, id, last.attempt)
  }
  return evaluateCondition(when, { needExitCodes, attemptRoot })
}

function appendSkip(
  host: ResolveHost,
  taskId: string,
  reason: "when" | "upstream_skip" | "branch"
): void {
  host.append({
    type: "task_skipped",
    runId: host.runId,
    taskId,
    reason,
    at: now(),
  })
}

/** Resolve looping tasks whose latest attempt has closed. */
export function resolveLoops(host: ResolveHost): void {
  const state = host.state()
  if (state.status !== "running" || state.cancelRequested) return

  for (const task of state.graph.tasks) {
    if (!task.retry && !task.repeat) continue
    const live = state.tasks[task.id]
    if (!live || live.status !== "running") continue
    if (live.attempts.some(isOpenAttempt)) continue
    if (live.attempts.length === 0) continue

    const last = live.attempts[live.attempts.length - 1]!
    // Spawn agents: success path is resolveSpawn (DES-005).
    if (
      isAgentTask(task) &&
      task.spawn === true &&
      last.exitCode === 0 &&
      !last.interrupted
    ) {
      continue
    }
    const attemptRoot = attemptDir(host.runRoot, task.id, last.attempt)
    const untilPassed =
      last.exitCode === 0
        ? evalUntil(task, attemptRoot, last.exitCode)
        : undefined
    const decision = decideLoop(task, live, untilPassed)

    if (decision.action === "succeed") {
      host.append({
        type: "task_succeeded",
        runId: host.runId,
        taskId: task.id,
        at: now(),
      })
    } else if (decision.action === "fail") {
      host.append({
        type: "task_failed",
        runId: host.runId,
        taskId: task.id,
        at: now(),
      })
    } else if (decision.action === "retry") {
      host.scheduleRetry(task.id, decision.backoffMs)
    } else {
      host.launchAgain(task.id)
    }
  }
}

export function runHasHardFailure(state: RunState): boolean {
  const byId = new Map(state.graph.tasks.map((t) => [t.id, t]))
  return Object.values(state.tasks).some((t) => {
    if (t.status !== "failed") return false
    return !byId.get(t.id)?.continueOnError
  })
}

export function shouldSettleRun(
  state: RunState,
  readyCount: number,
  approvedCount: number,
  waitingApproval: boolean,
  pendingRetries: number
): boolean {
  if (state.status !== "running") return false
  if (pendingRetries > 0) return false
  if (hasOpenAttempts(state)) return false
  if (readyCount > 0 || approvedCount > 0 || waitingApproval) return false
  return !Object.values(state.tasks).some((t) => t.status === "running")
}

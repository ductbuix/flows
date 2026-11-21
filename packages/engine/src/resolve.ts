import {
  isAgentTask,
  needTaskId,
  type AgentTask,
  type EngineEvent,
  type Task,
  type When,
} from "@workspace/shared"
import { evaluateCondition, type ConditionContext } from "./conditions.ts"
import { hasOpenAttempts, isOpenAttempt, type RunState } from "./fold.ts"
import { decideLoop, evalUntil } from "./loops.ts"
import {
  isNeedObject,
  latestExitCode,
  needsStructurallyReady,
  shouldPropagateSkip,
} from "./needs.ts"
import { attemptDir } from "./paths.ts"
import { judgePromptAbs } from "./prompt-paths.ts"
import { resolveAttemptTimeout } from "./timeout.ts"

function now(): string {
  return new Date().toISOString()
}

export type ResolveHost = {
  runId: string
  runRoot: string
  workflowRoot: string
  state: () => RunState
  append: (event: EngineEvent) => void
  scheduleRetry: (taskId: string, backoffMs: number) => void
  launchAgain: (taskId: string) => void
  judgeCache: Map<string, Promise<boolean>>
}

/** Skip pending tasks for when / upstream skip / branch miss. */
export async function resolveSkips(host: ResolveHost): Promise<void> {
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

      if (await branchWhenFails(task, state, host)) {
        appendSkip(host, task.id, "branch")
        skipped = true
        break
      }

      if (
        task.when !== undefined &&
        !(await evalWhen(task.when, task, state, host))
      ) {
        appendSkip(host, task.id, "when")
        skipped = true
        break
      }
    }
    if (!skipped) return
  }
}

async function branchWhenFails(
  task: Task,
  state: RunState,
  host: ResolveHost
): Promise<boolean> {
  for (const need of task.needs) {
    if (!isNeedObject(need) || !need.when) continue
    const up = state.tasks[need.task]
    if (!up || (up.status !== "succeeded" && up.status !== "failed")) {
      continue
    }
    const last = up.attempts[up.attempts.length - 1]
    const attemptRoot = last
      ? attemptDir(host.runRoot, need.task, last.attempt)
      : undefined
    const upSpec = state.graph.tasks.find((t) => t.id === need.task)
    if (
      !(await evaluateCondition(need.when, {
        exitCode: latestExitCode(up),
        attemptRoot,
        workflowRoot: host.workflowRoot,
        judgeInstructionsAbs: judgePromptAbs(
          task,
          { kind: "need", needTaskId: need.task },
          host.workflowRoot,
          host.runRoot
        ),
        judgeCache: host.judgeCache,
        timeoutSeconds: upSpec
          ? resolveAttemptTimeout(upSpec, state.graph)
          : undefined,
        parentTask: agentParent(task),
        workflowAgent: state.graph.agent,
      }))
    ) {
      return true
    }
  }
  return false
}

async function evalWhen(
  when: When,
  task: Task,
  state: RunState,
  host: ResolveHost
): Promise<boolean> {
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
    if (last) attemptRoot = attemptDir(host.runRoot, id, last.attempt)
  }
  const ctx: ConditionContext = {
    needExitCodes,
    attemptRoot,
    workflowRoot: host.workflowRoot,
    judgeInstructionsAbs: judgePromptAbs(
      task,
      { kind: "when" },
      host.workflowRoot,
      host.runRoot
    ),
    judgeCache: host.judgeCache,
    timeoutSeconds: resolveAttemptTimeout(task, state.graph),
    parentTask: agentParent(task),
    workflowAgent: state.graph.agent,
  }
  return evaluateCondition(when, ctx)
}

function agentParent(task: Task): AgentTask | undefined {
  return isAgentTask(task) ? task : undefined
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
export async function resolveLoops(host: ResolveHost): Promise<void> {
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
        ? await evalUntil(task, attemptRoot, last.exitCode, {
            workflowRoot: host.workflowRoot,
            judgeInstructionsAbs: judgePromptAbs(
              task,
              { kind: "until" },
              host.workflowRoot,
              host.runRoot
            ),
            judgeCache: host.judgeCache,
            timeoutSeconds: resolveAttemptTimeout(task, state.graph),
            parentTask: agentParent(task),
            workflowAgent: state.graph.agent,
          })
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

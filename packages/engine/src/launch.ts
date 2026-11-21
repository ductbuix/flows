import { existsSync } from "node:fs"
import type {
  EngineEvent,
  TaskStatus,
  Workflow,
  WorkflowLimits,
} from "@workspace/shared"
import { isAgentTask } from "@workspace/shared"
import { resolveAttemptModelFields } from "./attempt-model.ts"
import { watchChild, type AttemptWatchHost } from "./attempt-watch.ts"
import { prepareAttemptDirs } from "./dirs.ts"
import { approvedAwaitingIds, readyTaskIds, type RunState } from "./fold.ts"
import { fitsLimits, limitCaps } from "./limits.ts"
import { portLeaseKey, portLeases, type PortBlock } from "./port-lease.ts"
import { taskPromptAbs } from "./prompt-paths.ts"
import { launchTask } from "./runner.ts"
import { resolveAttemptTimeout } from "./timeout.ts"

function now(): string {
  return new Date().toISOString()
}

export type LaunchHost = {
  runId: string
  runRoot: string
  workflowRoot: string
  graph: Workflow
  state: () => RunState
  append: (event: EngineEvent) => void
  watchHost: () => AttemptWatchHost
  globalLimits?: WorkflowLimits
}

/** Request approval or launch ready / approved-awaiting tasks under limits. */
export async function launchReadyTasks(host: LaunchHost): Promise<void> {
  const state = host.state()
  const graph = state.graph
  const byId = new Map(graph.tasks.map((t) => [t.id, t]))
  const caps = limitCaps(host.globalLimits, graph)
  const toLaunch = [
    ...readyTaskIds(state).filter((id) => {
      const spec = byId.get(id)
      const task = state.tasks[id]
      if (!spec?.approval || task?.approved) return true
      host.append({
        type: "approval_requested",
        runId: host.runId,
        taskId: id,
        at: now(),
      })
      return false
    }),
    ...approvedAwaitingIds(state),
  ]

  for (const taskId of toLaunch) {
    const spec = byId.get(taskId)
    if (!spec) continue
    // Re-fold after each launch so slots stay accurate.
    const live = host.state()
    if (!fitsLimits(spec, live, live.graph, caps)) continue
    await launchTaskAttempt(host, taskId, ["pending", "awaiting_approval"])
  }
}

/** Launch another attempt for a running task (retry / repeat / spawn). */
export async function launchTaskAttempt(
  host: LaunchHost,
  taskId: string,
  allowed: TaskStatus[]
): Promise<void> {
  let graph: Workflow
  try {
    graph = host.state().graph
  } catch {
    return
  }
  const byId = new Map(graph.tasks.map((t) => [t.id, t]))
  const task = byId.get(taskId)
  if (!task) return
  try {
    if (host.state().cancelRequested) return
  } catch {
    return
  }
  const live = host.state().tasks[taskId]
  if (!live || !allowed.includes(live.status)) return

  const attempt = live.attempts.length + 1
  const startedAt = now()
  const timeout = resolveAttemptTimeout(task, graph)
  host.append({
    type: "attempt_started",
    runId: host.runId,
    taskId,
    attempt,
    at: startedAt,
  })

  if (isAgentTask(task)) {
    const prompt = taskPromptAbs(task, host.workflowRoot, host.runRoot)
    if (!existsSync(prompt)) {
      host.append({
        type: "attempt_finished",
        runId: host.runId,
        taskId,
        attempt,
        exitCode: 1,
        reason: "missing_prompt",
        at: now(),
      })
      return
    }
  }

  const leaseKey = portLeaseKey(host.runId, taskId, attempt)
  let ports: PortBlock
  try {
    ports = await portLeases.lease(leaseKey)
  } catch {
    try {
      host.append({
        type: "attempt_finished",
        runId: host.runId,
        taskId,
        attempt,
        exitCode: 1,
        reason: "no_port_block",
        at: now(),
      })
    } catch {
      /* engine closed during lease */
    }
    return
  }

  // Create attempt dirs after the lease so resume tests that wait on
  // attempt-*/out do not kill the harness mid-bind-check.
  prepareAttemptDirs(host.runRoot, taskId, attempt)

  let launched
  try {
    launched = launchTask(
      task,
      attempt,
      {
        workflowRoot: host.workflowRoot,
        runRoot: host.runRoot,
        runId: host.runId,
      },
      host.state().graph,
      ports
    )
  } catch (err) {
    portLeases.release(leaseKey)
    if (
      err instanceof Error &&
      (err.message.includes("database is not open") ||
        err.message.includes("no events"))
    ) {
      return
    }
    throw err
  }

  const modelFields = resolveAttemptModelFields(task, host.state().graph)
  try {
    host.append({
      type: "attempt_launched",
      runId: host.runId,
      taskId,
      attempt,
      pid: launched.pid,
      sandboxed: launched.sandboxed,
      timeout,
      portBase: ports.base,
      portCount: ports.count,
      ...(modelFields ?? {}),
      at: now(),
    })
  } catch {
    portLeases.release(leaseKey)
    return
  }
  watchChild(host.watchHost(), taskId, attempt, launched.child, {
    timeoutSeconds: timeout,
    startedAt,
  })
}

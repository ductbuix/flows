import type {
  EngineEvent,
  TaskStatus,
  Workflow,
  WorkflowLimits,
} from "@workspace/shared"
import { watchChild, type AttemptWatchHost } from "./attempt-watch.ts"
import { prepareAttemptDirs } from "./dirs.ts"
import { approvedAwaitingIds, readyTaskIds, type RunState } from "./fold.ts"
import { fitsLimits, limitCaps } from "./limits.ts"
import { launchTask } from "./runner.ts"

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
export function launchReadyTasks(host: LaunchHost): void {
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
    launchTaskAttempt(host, taskId, ["pending", "awaiting_approval"])
  }
}

/** Launch another attempt for a running task (retry / repeat / spawn). */
export function launchTaskAttempt(
  host: LaunchHost,
  taskId: string,
  allowed: TaskStatus[]
): void {
  const graph = host.state().graph
  const byId = new Map(graph.tasks.map((t) => [t.id, t]))
  const task = byId.get(taskId)
  if (!task) return
  if (host.state().cancelRequested) return
  const live = host.state().tasks[taskId]
  if (!live || !allowed.includes(live.status)) return

  const attempt = live.attempts.length + 1
  host.append({
    type: "attempt_started",
    runId: host.runId,
    taskId,
    attempt,
    at: now(),
  })
  prepareAttemptDirs(host.runRoot, taskId, attempt)

  const { child, pid, sandboxed } = launchTask(
    task,
    attempt,
    {
      workflowRoot: host.workflowRoot,
      runRoot: host.runRoot,
      runId: host.runId,
    },
    host.state().graph
  )

  host.append({
    type: "attempt_launched",
    runId: host.runId,
    taskId,
    attempt,
    pid,
    sandboxed,
    at: now(),
  })
  watchChild(host.watchHost(), taskId, attempt, child)
}

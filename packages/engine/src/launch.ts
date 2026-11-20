import type { EngineEvent, TaskStatus, Workflow } from "@workspace/shared"
import { watchChild, type AttemptWatchHost } from "./attempt-watch.ts"
import { prepareAttemptDirs } from "./dirs.ts"
import { approvedAwaitingIds, readyTaskIds, type RunState } from "./fold.ts"
import { launchCommand } from "./runner.ts"

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
}

/** Request approval or launch ready / approved-awaiting command tasks. */
export function launchReadyTasks(host: LaunchHost): void {
  const state = host.state()
  const byId = new Map(host.graph.tasks.map((t) => [t.id, t]))
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
    launchTaskAttempt(host, taskId, ["pending", "awaiting_approval"])
  }
}

/** Launch another attempt for a running task (retry / repeat). */
export function launchTaskAttempt(
  host: LaunchHost,
  taskId: string,
  allowed: TaskStatus[]
): void {
  const byId = new Map(host.graph.tasks.map((t) => [t.id, t]))
  const task = byId.get(taskId)
  if (!task || task.kind !== "command") return
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

  const { child, pid } = launchCommand(
    task,
    attempt,
    {
      workflowRoot: host.workflowRoot,
      runRoot: host.runRoot,
      runId: host.runId,
    },
    host.graph
  )

  host.append({
    type: "attempt_launched",
    runId: host.runId,
    taskId,
    attempt,
    pid,
    at: now(),
  })
  watchChild(host.watchHost(), taskId, attempt, child)
}

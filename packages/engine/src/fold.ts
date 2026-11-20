import type {
  EngineEvent,
  RunStatus,
  TaskStatus,
  Workflow,
} from "@workspace/shared"

export type AttemptState = {
  attempt: number
  pid?: number
  exitCode?: number
  interrupted?: boolean
}

export type TaskState = {
  id: string
  status: TaskStatus
  /** Set after task_approved; gate only asks once (DES-003). */
  approved?: boolean
  failReason?: "rejected"
  attempts: AttemptState[]
}

export type RunState = {
  runId: string
  workflowId: string
  status: RunStatus
  graph: Workflow
  tasks: Record<string, TaskState>
  cancelRequested?: boolean
  deleted?: boolean
}

const TERMINAL_TASK: ReadonlySet<TaskStatus> = new Set([
  "succeeded",
  "failed",
  "cancelled",
])

function emptyTasks(graph: Workflow): Record<string, TaskState> {
  const tasks: Record<string, TaskState> = {}
  for (const task of graph.tasks) {
    tasks[task.id] = { id: task.id, status: "pending", attempts: [] }
  }
  return tasks
}

function setTaskStatus(task: TaskState, status: TaskStatus): void {
  if (TERMINAL_TASK.has(task.status)) return
  task.status = status
}

/** Fold engine events into run state. Pure; no I/O. */
export function foldEvents(events: EngineEvent[]): RunState | null {
  let state: RunState | null = null

  for (const event of events) {
    switch (event.type) {
      case "run_started": {
        state = {
          runId: event.runId,
          workflowId: event.workflowId,
          status: "running",
          graph: event.graph,
          tasks: emptyTasks(event.graph),
        }
        break
      }
      case "approval_requested": {
        if (!state) break
        const task = state.tasks[event.taskId]
        if (task) setTaskStatus(task, "awaiting_approval")
        break
      }
      case "task_approved": {
        if (!state) break
        const task = state.tasks[event.taskId]
        if (task) task.approved = true
        break
      }
      case "task_rejected": {
        if (!state) break
        const task = state.tasks[event.taskId]
        if (task && !TERMINAL_TASK.has(task.status)) {
          task.status = "failed"
          task.failReason = "rejected"
        }
        break
      }
      case "attempt_started": {
        if (!state) break
        const task = state.tasks[event.taskId]
        if (!task) break
        setTaskStatus(task, "running")
        task.attempts.push({ attempt: event.attempt })
        break
      }
      case "attempt_launched": {
        if (!state) break
        const task = state.tasks[event.taskId]
        const attempt = task?.attempts.find((a) => a.attempt === event.attempt)
        if (attempt) attempt.pid = event.pid
        break
      }
      case "attempt_finished": {
        if (!state) break
        const task = state.tasks[event.taskId]
        const attempt = task?.attempts.find((a) => a.attempt === event.attempt)
        if (attempt) attempt.exitCode = event.exitCode
        if (task) {
          setTaskStatus(task, event.exitCode === 0 ? "succeeded" : "failed")
        }
        break
      }
      case "attempt_interrupted": {
        if (!state) break
        const task = state.tasks[event.taskId]
        const attempt = task?.attempts.find((a) => a.attempt === event.attempt)
        if (attempt) attempt.interrupted = true
        // Until BL-006 retry policy: interrupt ends the task as failed.
        if (task) setTaskStatus(task, "failed")
        break
      }
      case "cancel_requested": {
        if (!state) break
        state.cancelRequested = true
        break
      }
      case "task_cancelled": {
        if (!state) break
        const task = state.tasks[event.taskId]
        if (task && !TERMINAL_TASK.has(task.status)) {
          task.status = "cancelled"
        }
        break
      }
      case "run_cancelled": {
        if (!state) break
        state.status = "cancelled"
        break
      }
      case "run_succeeded": {
        if (!state) break
        state.status = "succeeded"
        break
      }
      case "run_failed": {
        if (!state) break
        state.status = "failed"
        break
      }
      case "run_deleted": {
        if (!state) break
        state.deleted = true
        break
      }
    }
  }

  return state
}

/** Tasks that are pending and whose needs have all succeeded. */
export function readyTaskIds(state: RunState): string[] {
  const byId = new Map(state.graph.tasks.map((t) => [t.id, t]))
  const ready: string[] = []
  for (const task of state.graph.tasks) {
    const current = state.tasks[task.id]
    if (!current || current.status !== "pending") continue
    const needs = byId.get(task.id)?.needs ?? []
    const ok = needs.every((id) => state.tasks[id]?.status === "succeeded")
    if (ok) ready.push(task.id)
  }
  return ready
}

/**
 * Approved gated tasks waiting to launch. Holds no concurrency slot
 * until attempt_started (DES-003).
 */
export function approvedAwaitingIds(state: RunState): string[] {
  return Object.values(state.tasks)
    .filter((t) => t.status === "awaiting_approval" && t.approved)
    .map((t) => t.id)
}

/** Attempt started or launched with no finish and no interrupt. */
export function isOpenAttempt(attempt: AttemptState): boolean {
  return attempt.exitCode === undefined && !attempt.interrupted
}

export function hasOpenAttempts(state: RunState): boolean {
  return Object.values(state.tasks).some((task) =>
    task.attempts.some(isOpenAttempt)
  )
}

/** Open attempts across the run (for resume). */
export function openAttempts(
  state: RunState
): Array<{ taskId: string; attempt: AttemptState }> {
  const out: Array<{ taskId: string; attempt: AttemptState }> = []
  for (const task of Object.values(state.tasks)) {
    for (const attempt of task.attempts) {
      if (isOpenAttempt(attempt)) {
        out.push({ taskId: task.id, attempt })
      }
    }
  }
  return out
}

export function isUnfinishedTask(status: TaskStatus): boolean {
  return (
    status === "pending" ||
    status === "awaiting_approval" ||
    status === "running"
  )
}

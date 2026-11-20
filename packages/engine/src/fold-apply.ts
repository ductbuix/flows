import type { EngineEvent, Workflow } from "@workspace/shared"
import type { RunState, TaskState } from "./fold.ts"

const TERMINAL_TASK: ReadonlySet<string> = new Set([
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
])

function emptyTasks(graph: Workflow): Record<string, TaskState> {
  const tasks: Record<string, TaskState> = {}
  for (const task of graph.tasks) {
    tasks[task.id] = { id: task.id, status: "pending", attempts: [] }
  }
  return tasks
}

function setTaskStatus(task: TaskState, status: TaskState["status"]): void {
  if (TERMINAL_TASK.has(task.status)) return
  task.status = status
}

function taskSpec(state: RunState, taskId: string) {
  return state.graph.tasks.find((t) => t.id === taskId)
}

function hasLoopPolicy(state: RunState, taskId: string): boolean {
  const spec = taskSpec(state, taskId)
  return Boolean(spec?.retry || spec?.repeat)
}

function hasRetryPolicy(state: RunState, taskId: string): boolean {
  return Boolean(taskSpec(state, taskId)?.retry)
}

/** Apply one event to mutable run state. Returns the (possibly new) state. */
export function applyEvent(
  state: RunState | null,
  event: EngineEvent
): RunState | null {
  switch (event.type) {
    case "run_started":
      return {
        runId: event.runId,
        workflowId: event.workflowId,
        status: "running",
        graph: event.graph,
        tasks: emptyTasks(event.graph),
      }
    case "approval_requested": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      if (task) setTaskStatus(task, "awaiting_approval")
      return state
    }
    case "task_approved": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      if (task) task.approved = true
      return state
    }
    case "task_rejected": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      if (task && !TERMINAL_TASK.has(task.status)) {
        task.status = "failed"
        task.failReason = "rejected"
      }
      return state
    }
    case "attempt_started": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      if (!task) return state
      setTaskStatus(task, "running")
      task.attempts.push({ attempt: event.attempt })
      return state
    }
    case "attempt_launched": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      const attempt = task?.attempts.find((a) => a.attempt === event.attempt)
      if (attempt) attempt.pid = event.pid
      return state
    }
    case "attempt_finished": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      const attempt = task?.attempts.find((a) => a.attempt === event.attempt)
      if (attempt) attempt.exitCode = event.exitCode
      if (!task || TERMINAL_TASK.has(task.status)) return state
      if (hasLoopPolicy(state, event.taskId)) return state
      setTaskStatus(task, event.exitCode === 0 ? "succeeded" : "failed")
      return state
    }
    case "attempt_interrupted": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      const attempt = task?.attempts.find((a) => a.attempt === event.attempt)
      if (attempt) attempt.interrupted = true
      if (!task || TERMINAL_TASK.has(task.status)) return state
      if (hasRetryPolicy(state, event.taskId)) return state
      setTaskStatus(task, "failed")
      return state
    }
    case "task_succeeded": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      if (task) setTaskStatus(task, "succeeded")
      return state
    }
    case "task_failed": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      if (task) setTaskStatus(task, "failed")
      return state
    }
    case "task_skipped": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      if (task && !TERMINAL_TASK.has(task.status)) {
        task.status = "skipped"
        task.skipReason = event.reason
      }
      return state
    }
    case "cancel_requested": {
      if (!state) return state
      state.cancelRequested = true
      return state
    }
    case "task_cancelled": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      if (task && !TERMINAL_TASK.has(task.status)) {
        task.status = "cancelled"
      }
      return state
    }
    case "run_cancelled": {
      if (!state) return state
      state.status = "cancelled"
      return state
    }
    case "run_succeeded": {
      if (!state) return state
      state.status = "succeeded"
      return state
    }
    case "run_failed": {
      if (!state) return state
      state.status = "failed"
      return state
    }
    case "run_deleted": {
      if (!state) return state
      state.deleted = true
      return state
    }
  }
}

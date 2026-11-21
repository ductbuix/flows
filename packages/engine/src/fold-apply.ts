import {
  isAgentTask,
  type EngineEvent,
  type Task,
  type Workflow,
} from "@workspace/shared"
import type { RunState, TaskState } from "./fold.ts"
import { applyTaskRetryRequested } from "./fold-retry.ts"

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

/**
 * Whether attempt_finished should leave the task running for the
 * scheduler to settle (retry, repeat, or spawn accept on success).
 */
export function delaysTerminalOnFinish(
  task: Task | undefined,
  exitCode: number
): boolean {
  if (!task) return false
  if (task.retry || task.repeat) return true
  // Spawn post-step only applies after a successful attempt (DES-005).
  return isAgentTask(task) && task.spawn === true && exitCode === 0
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
        status: event.queued === true ? "queued" : "running",
        graph: event.graph,
        tasks: emptyTasks(event.graph),
        // Optimistic until an unrestricted attempt_launched (DES-006).
        sandboxed: true,
        trustGrant: event.trustGrant,
        startedAt: event.at,
        source: event.source,
        itemKey: event.itemKey,
        inputHash: event.inputHash,
        inputFiles: event.files,
      }
    case "run_activated": {
      if (!state) return state
      if (state.status === "queued") state.status = "running"
      return state
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
      const manualRetry = task.manualRetryPending === true
      if (manualRetry) delete task.manualRetryPending
      task.attempts.push({
        attempt: event.attempt,
        startedAt: event.at,
        ...(manualRetry ? { manualRetry: true } : {}),
      })
      return state
    }
    case "attempt_launched": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      const attempt = task?.attempts.find((a) => a.attempt === event.attempt)
      if (attempt) {
        attempt.pid = event.pid
        if (event.timeout !== undefined) attempt.timeout = event.timeout
        if (event.model !== undefined) attempt.model = event.model
        if (event.effort !== undefined) attempt.effort = event.effort
        if (event.modelSource !== undefined) {
          attempt.modelSource = event.modelSource
        }
      }
      // Missing sandboxed (older events) counts as unrestricted.
      if (event.sandboxed !== true) state.sandboxed = false
      return state
    }
    case "attempt_finished": {
      if (!state) return state
      const task = state.tasks[event.taskId]
      const attempt = task?.attempts.find((a) => a.attempt === event.attempt)
      if (attempt) {
        attempt.exitCode = event.exitCode
        if (event.reason !== undefined) attempt.reason = event.reason
      }
      if (!task || TERMINAL_TASK.has(task.status)) return state
      if (
        delaysTerminalOnFinish(taskSpec(state, event.taskId), event.exitCode)
      ) {
        return state
      }
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
    case "tasks_spawned": {
      if (!state) return state
      for (const spawned of event.tasks) {
        if (state.graph.tasks.some((t) => t.id === spawned.id)) continue
        state.graph.tasks.push(spawned)
        state.tasks[spawned.id] = {
          id: spawned.id,
          status: "pending",
          attempts: [],
        }
      }
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
    case "task_retry_requested": {
      if (!state) return state
      return applyTaskRetryRequested(state, event.taskId)
    }
  }
}

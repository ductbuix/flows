import type { EngineEvent, RunStatus, TaskStatus, Workflow } from "@workspace/shared"
import { applyEvent } from "./fold-apply.ts"
import { needsStructurallyReady } from "./needs.ts"

export type AttemptState = {
  attempt: number
  pid?: number
  exitCode?: number
  interrupted?: boolean
  /** Next attempt after task_retry_requested (DES-011). */
  manualRetry?: boolean
}

export type TaskState = {
  id: string
  status: TaskStatus
  /** Set after task_approved; gate only asks once (DES-003). */
  approved?: boolean
  failReason?: "rejected"
  skipReason?: "when" | "upstream_skip" | "branch"
  /** Next attempt_started is a manual retry (DES-011). */
  manualRetryPending?: boolean
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

/** Fold engine events into run state. Pure; no I/O. */
export function foldEvents(events: EngineEvent[]): RunState | null {
  let state: RunState | null = null
  for (const event of events) {
    state = applyEvent(state, event)
  }
  return state
}

/** Tasks that are pending and whose needs are structurally ready. */
export function readyTaskIds(state: RunState): string[] {
  const byId = new Map(state.graph.tasks.map((t) => [t.id, t]))
  const ready: string[] = []
  for (const task of state.graph.tasks) {
    const current = state.tasks[task.id]
    if (!current || current.status !== "pending") continue
    const spec = byId.get(task.id)
    if (!spec) continue
    if (needsStructurallyReady(spec, state)) ready.push(task.id)
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

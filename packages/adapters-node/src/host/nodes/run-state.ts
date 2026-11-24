import type {
  Effort,
  EngineEvent,
  ModelSource,
  RunStatus,
  TaskStatus,
  Workflow,
} from "@workspace/contracts"
import {
  foldSteps,
  type StepState,
  type StepStatus,
  type StepsState,
} from "./fold-steps.ts"

/** The latest attempt of a node, as the run view reads it. */
export type AttemptState = {
  attempt: number
  pid?: number
  exitCode?: number
  interrupted?: boolean
  startedAt?: string
  /** Resolved seconds from attempt_launched (DES-019). */
  timeout?: number
  /** timeout or mapped CLI stderr (DES-019). */
  reason?: string
  model?: string
  effort?: Effort
  modelSource?: ModelSource
}

/** Run-view state of one node: its latest step and attempt. */
export type TaskState = {
  id: string
  status: TaskStatus
  attempts: AttemptState[]
}

/** One run folded from its events (DES-034). */
export type RunState = {
  runId: string
  workflowId: string
  status: RunStatus
  /** The node graph frozen at `run_started`. */
  graph: Workflow
  /** One entry per node, from the step fold. */
  tasks: Record<string, TaskState>
  steps: StepsState
  /**
   * True when every launched attempt was sandboxed. Flips to false on the
   * first unrestricted launch (DES-006 warning badge).
   */
  sandboxed: boolean
  /** Trust-once grant from run_started (DES-019). */
  trustGrant?: "once"
  /** ISO time from run_started (DES-021 FIFO queue). */
  startedAt?: string
  /** ISO time from run_succeeded / run_failed / run_cancelled. */
  finishedAt?: string
  /** Manual item key from run_started (DES-021). */
  itemKey?: string
  /** Docket card from run_started (DES-038 / BL-039). */
  cardId?: string
  source?: "manual"
  inputHash?: string
  inputFiles?: string[]
  cancelRequested?: boolean
  deleted?: boolean
}

/** Live for rename/delete blocking: queued or running (DES-021). */
export function isLiveRunStatus(status: RunStatus): boolean {
  return status === "queued" || status === "running"
}

const STATUS: Record<StepStatus, TaskStatus> = {
  pending: "pending",
  running: "running",
  waiting: "awaiting_approval",
  done: "succeeded",
  failed: "failed",
  skipped: "skipped",
  cancelled: "cancelled",
}

/** Run-view status of a step (BL-087). */
export function stepTaskStatus(status: StepStatus): TaskStatus {
  return STATUS[status]
}

function taskOf(nodeId: string, step: StepState | undefined): TaskState {
  if (!step) return { id: nodeId, status: "pending", attempts: [] }
  const c = step.current
  return {
    id: nodeId,
    status: STATUS[step.status],
    attempts: c
      ? [
          {
            attempt: c.attempt,
            pid: c.pid,
            exitCode: c.exitCode,
            interrupted: c.interrupted,
            startedAt: c.startedAt,
            timeout: c.timeout,
            reason: c.reason,
            model: c.model,
            effort: c.effort,
            modelSource: c.modelSource,
          },
        ]
      : [],
  }
}

/** Fold engine events into run state. Pure; no I/O. */
export function foldEvents(events: readonly EngineEvent[]): RunState | null {
  let state: RunState | null = null
  for (const event of events) {
    switch (event.type) {
      case "run_started":
        state = {
          runId: event.runId,
          workflowId: event.workflowId,
          status: event.queued === true ? "queued" : "running",
          graph: event.graph,
          tasks: {},
          steps: { steps: {}, ended: false },
          // Optimistic until an unrestricted attempt_launched (DES-006).
          sandboxed: true,
          trustGrant: event.trustGrant,
          startedAt: event.at,
          source: event.source,
          itemKey: event.itemKey,
          cardId: event.cardId,
          inputHash: event.inputHash,
          inputFiles: event.files,
        }
        break
      case "run_activated":
        if (state?.status === "queued") state.status = "running"
        break
      case "attempt_launched":
        // Missing sandboxed (older events) counts as unrestricted.
        if (state && event.sandboxed !== true) state.sandboxed = false
        break
      case "cancel_requested":
        if (state) state.cancelRequested = true
        break
      case "run_cancelled":
      case "run_succeeded":
      case "run_failed":
        if (state) {
          state.status = event.type.slice(4) as RunStatus
          state.finishedAt = event.at
        }
        break
      case "run_deleted":
        if (state) state.deleted = true
        break
      case "step_retry_requested":
        // A manual retry reopens a settled run (DES-034, Retry).
        if (
          state &&
          (state.status === "failed" || state.status === "succeeded")
        ) {
          state.status = "running"
          state.finishedAt = undefined
        }
        break
      default:
        break
    }
  }
  if (!state) return null
  const steps = foldSteps(events)
  state.steps = steps
  for (const n of state.graph.nodes) {
    const list = steps.steps[n.id]
    state.tasks[n.id] = taskOf(n.id, list?.[list.length - 1])
  }
  return state
}

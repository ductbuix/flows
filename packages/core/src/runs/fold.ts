import type { EngineEvent, Workflow } from "@workspace/contracts"
import { emptySteps, type RunState } from "./model.ts"
import { foldSteps } from "./fold-steps.ts"

function initialFromStart(
  event: Extract<EngineEvent, { type: "run_started" }>
): RunState {
  return {
    runId: event.runId,
    workflowId: event.workflowId,
    status: event.queued === true ? "queued" : "running",
    graph: event.graph as Workflow,
    steps: emptySteps(),
    trigger: event.trigger,
    only: event.only,
    from: event.from,
    startedAt: event.at,
    workItemId: event.workItemId,
    seq: 1,
  }
}

/**
 * Pure fold of one event into run state. `null` before `run_started`.
 * No I/O and no clock reads (DES-041, DES-042).
 */
export function fold(
  state: RunState | null,
  event: EngineEvent
): RunState | null {
  if (event.type === "run_started") return initialFromStart(event)
  if (!state) return null

  const seq = state.seq + 1
  let next: RunState = { ...state, seq }

  switch (event.type) {
    case "run_activated":
      if (next.status === "queued") next = { ...next, status: "running" }
      break
    case "cancel_requested":
      next = { ...next, cancelRequested: true }
      break
    case "run_cancelled":
    case "run_succeeded":
    case "run_failed":
      next = {
        ...next,
        status: event.type.slice(4) as RunState["status"],
        finishedAt: event.at,
      }
      break
    case "run_deleted":
      next = { ...next, deleted: true }
      break
    case "step_retry_requested":
      if (next.status === "failed" || next.status === "succeeded") {
        next = { ...next, status: "running", finishedAt: undefined }
      }
      break
    default:
      break
  }

  return { ...next, steps: foldSteps(state.steps, event, seq) }
}

/** Fold every event from null (test helper). */
export function foldAll(events: readonly EngineEvent[]): RunState | null {
  return events.reduce<RunState | null>((s, e) => fold(s, e), null)
}

export { foldAllSteps, foldSteps } from "./fold-steps.ts"

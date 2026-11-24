import type { EventLog } from "../event-log.ts"
import { killProcessGroup } from "../../pid.ts"
import { foldSteps, isOpenStep } from "./fold-steps.ts"

const now = () => new Date().toISOString()

/** True once `cancel_requested` is in the log. */
export function cancelRequested(events: readonly { type: string }[]): boolean {
  return events.some((e) => e.type === "cancel_requested")
}

/**
 * Finishes a cancel after `cancel_requested` (also on resume): ends
 * open process groups, then `step_cancelled` for every open step, then
 * `run_cancelled`. Safe to repeat.
 */
export function finishNodeCancel(log: EventLog, runId: string): void {
  const events = log.listByRun(runId).map((s) => s.event)
  const steps = foldSteps(events)
  if (steps.ended) return
  const rejected = events.some((e) => e.type === "step_rejected")
  for (const list of Object.values(steps.steps)) {
    for (const s of list) {
      if (s.current?.open && s.current.pid !== undefined) {
        killProcessGroup(s.current.pid)
      }
    }
  }
  for (const list of Object.values(steps.steps)) {
    for (const s of list) {
      if (!isOpenStep(s)) continue
      log.append({
        type: "step_cancelled",
        runId,
        at: now(),
        nodeId: s.nodeId,
        pass: s.pass,
      })
    }
  }
  log.append({
    type: "run_cancelled",
    runId,
    at: now(),
    ...(rejected ? { reason: "rejected" as const } : {}),
  })
}

/** Cancels a live node run: `cancel_requested`, then the finish. */
export function cancelNodeRun(log: EventLog, runId: string): void {
  const events = log.listByRun(runId).map((s) => s.event)
  if (foldSteps(events).ended) return
  if (!cancelRequested(events)) {
    log.append({ type: "cancel_requested", runId, at: now() })
  }
  finishNodeCancel(log, runId)
}

import type { EventLog } from "../event-log.ts"
import { killProcessGroup } from "../pid.ts"
import { foldSteps, isOpenStep } from "./fold-steps.ts"

const now = () => new Date().toISOString()

/** True once `cancel_requested` is in the log. */
export function cancelRequested(
  events: readonly { type: string }[]
): boolean {
  return events.some((e) => e.type === "cancel_requested")
}

/**
 * Finishes a cancel after `cancel_requested` (also on resume): ends
 * open process groups, then `step_cancelled` for every open step, then
 * `run_cancelled` (DES-034, Cancel). Safe to repeat.
 */
export function finishNodeCancel(log: EventLog, runId: string): void {
  const events = log.listByRun(runId).map((s) => s.event)
  const steps = foldSteps(events)
  if (steps.ended) return
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
  log.append({ type: "run_cancelled", runId, at: now() })
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

const STEP_RETRYABLE = new Set(["failed"])

/**
 * Manual retry (DES-034, Retry): resets the failed step and every step
 * that follows it, so the walk runs them again. The caller restarts the
 * driver. Throws when the step cannot be retried.
 */
export function requestNodeRetry(
  log: EventLog,
  runId: string,
  nodeId: string,
  edges: readonly { from: string; to: string }[]
): void {
  const events = log.listByRun(runId).map((s) => s.event)
  const steps = foldSteps(events)
  const step = steps.steps[nodeId]?.at(-1)
  if (!step || !STEP_RETRYABLE.has(step.status)) {
    throw new Error(`task ${nodeId} cannot be retried`)
  }
  if (!steps.ended) throw new Error(`task ${nodeId} cannot be retried`)
  if (events.some((e) => e.type === "run_cancelled")) {
    throw new Error(`task ${nodeId} cannot be retried`)
  }
  const reset = new Set([nodeId])
  for (let grew = true; grew; ) {
    grew = false
    for (const e of edges) {
      if (reset.has(e.from) && !reset.has(e.to)) {
        reset.add(e.to)
        grew = true
      }
    }
  }
  for (const id of reset) {
    const s = steps.steps[id]?.at(-1)
    if (!s) continue
    log.append({
      type: "step_retry_requested",
      runId,
      at: now(),
      nodeId: id,
      pass: s.pass,
    })
  }
}

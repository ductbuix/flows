import type { EventLog } from "./event-log.ts"
import { foldEvents, type RunState } from "./nodes/run-state.ts"

/** Fold one run from the event log (same as `Host.fold`). */
export function foldLoggedRun(log: EventLog, runId: string): RunState | null {
  return foldEvents(log.listByRun(runId).map((e) => e.event))
}

/** Every non-deleted run folded from the event log (same as `Host.listRuns`). */
export function listLoggedRuns(log: EventLog): RunState[] {
  const out: RunState[] = []
  for (const runId of log.listRunIds()) {
    const state = foldLoggedRun(log, runId)
    if (state && !state.deleted) out.push(state)
  }
  return out
}

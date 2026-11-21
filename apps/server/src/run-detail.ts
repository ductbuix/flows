import type { Engine } from "@workspace/engine"
import type { RunDetail, RunSummary } from "@workspace/shared"
import { effectsFromEvents } from "./run-effects.ts"
import { runTimestamps, toRunDetail } from "./run-mapper.ts"
import { buildRunPins } from "./run-pins.ts"

export function buildRunDetail(
  engine: Engine,
  runId: string
): RunDetail | null {
  const state = engine.fold(runId)
  if (!state || state.deleted) return null
  const stored = engine.eventsWithSeq(runId)
  const events = stored.map((s) => s.event)
  const ts = runTimestamps(events)
  const lastSeq = stored.length > 0 ? stored[stored.length - 1]!.seq : 0
  const detail = toRunDetail(state, {
    startedAt: ts.startedAt,
    finishedAt:
      state.status === "running" || state.status === "queued"
        ? undefined
        : ts.finishedAt,
    lastSeq,
  })
  return {
    ...detail,
    pins: buildRunPins(engine, state.workflowId, runId, state.graph),
    effects: effectsFromEvents(events),
  }
}

export function buildRunSummaries(
  engine: Engine,
  workflowId: string
): RunSummary[] {
  return engine.listRunSummaries({ workflowId })
}

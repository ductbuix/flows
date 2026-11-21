import type { Engine } from "@workspace/engine"
import type { RunDetail, RunSummary } from "@workspace/shared"
import { runTimestamps, toRunDetail } from "./run-mapper.ts"

export function buildRunDetail(
  engine: Engine,
  runId: string
): RunDetail | null {
  const state = engine.fold(runId)
  if (!state || state.deleted) return null
  const stored = engine.eventsWithSeq(runId)
  const ts = runTimestamps(stored.map((s) => s.event))
  const lastSeq = stored.length > 0 ? stored[stored.length - 1]!.seq : 0
  return toRunDetail(state, {
    startedAt: ts.startedAt,
    finishedAt:
      state.status === "running" || state.status === "queued"
        ? undefined
        : ts.finishedAt,
    lastSeq,
  })
}

export function buildRunSummaries(
  engine: Engine,
  workflowId: string
): RunSummary[] {
  return engine.listRunSummaries({ workflowId })
}

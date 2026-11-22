import { stepTaskStatus, type Engine, type RunState } from "@workspace/engine"
import type { RunDetail, RunStep, RunSummary } from "@workspace/shared"
import { effectsFromEvents } from "./run-effects.ts"
import { runTimestamps, toRunDetail } from "./run-mapper.ts"
import { buildRunPins } from "./run-pins.ts"

/** One row per pass of each node, in graph order (BL-087). */
function stepsOf(state: RunState): RunStep[] | undefined {
  if (!state.nodeGraph || !state.steps) return undefined
  const rows: RunStep[] = []
  for (const node of state.nodeGraph.nodes) {
    for (const step of state.steps.steps[node.id] ?? []) {
      rows.push({
        nodeId: node.id,
        kind: node.kind,
        pass: step.pass,
        attempts: step.attempts,
        status: stepTaskStatus(step.status),
        ...(step.branch ? { branch: step.branch } : {}),
        ...(step.failReason ? { failReason: step.failReason } : {}),
        ...(step.current?.startedAt ? { startedAt: step.current.startedAt } : {}),
        ...(step.current?.endedAt ? { endedAt: step.current.endedAt } : {}),
      })
    }
  }
  return rows
}

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
  const steps = stepsOf(state)
  return {
    ...detail,
    ...(steps ? { steps } : {}),
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

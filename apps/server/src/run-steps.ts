import { stepTaskStatus, type Engine } from "@workspace/engine"
import type { RunStep } from "@workspace/contracts"

/** Latest pass of every node in a run, for run/get and canvas status. */
export function stepsOfRun(engine: Engine, runId: string): RunStep[] {
  const state = engine.fold(runId)
  if (!state || state.deleted) return []
  const out: RunStep[] = []
  for (const node of state.graph.nodes) {
    const step = state.steps.steps[node.id]?.at(-1)
    if (!step) continue
    out.push({
      nodeId: node.id,
      kind: node.kind,
      pass: step.pass,
      attempts: step.attempts,
      status: stepTaskStatus(step.status),
      ...(step.branch ? { branch: step.branch } : {}),
      ...(step.failReason ? { failReason: step.failReason } : {}),
      ...(step.question !== undefined ? { question: step.question } : {}),
      ...(step.decision ? { decision: step.decision } : {}),
      ...(step.answer ? { answer: step.answer } : {}),
      ...(step.reused ? { reused: true as const } : {}),
      ...(step.current?.startedAt ? { startedAt: step.current.startedAt } : {}),
      ...(step.current?.endedAt ? { endedAt: step.current.endedAt } : {}),
    })
  }
  return out
}

/** One node's latest step, or null when the node has not run. */
export function stepOfNode(
  engine: Engine,
  runId: string,
  nodeId: string
): RunStep | null {
  return stepsOfRun(engine, runId).find((s) => s.nodeId === nodeId) ?? null
}

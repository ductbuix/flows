import type { RunEffect, RunState } from "./model.ts"
import { latestStep } from "./model.ts"

/** Source node ids of active edges into a node, in edge file order. */
export function activeInputs(state: RunState, nodeId: string): string[] {
  const out: string[] = []
  for (const e of state.graph.edges) {
    if (e.to !== nodeId) continue
    const s = latestStep(state.steps, e.from)
    if (s?.status !== "done") continue
    if (e.branch !== undefined && e.branch !== s.branch) continue
    out.push(e.from)
  }
  return out
}

/**
 * Pick the effect for a newly started (or retrying) step.
 * Trigger, approval and notify use `launch_step` so NodeKind.execute
 * runs on the actor (BL-134); folder output stays `write_output`.
 */
export function effectForRun(
  state: RunState,
  nodeId: string,
  pass: number,
  inputs: readonly string[],
  attempt: number
): RunEffect {
  const node = state.graph.nodes.find((n) => n.id === nodeId)
  if (node?.kind === "output" && node.target === "folder") {
    return { kind: "write_output", nodeId, pass, from: inputs }
  }
  return { kind: "launch_step", nodeId, pass, attempt }
}

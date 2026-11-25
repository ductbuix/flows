import { findLoopEdges } from "@workspace/contracts"
import type { RunState, StepState } from "../runs/model.ts"
import { latestStep } from "../runs/model.ts"

/** Node kinds that gate results instead of producing them (DES-034). */
const GATE_KINDS = new Set(["judge", "approval"])

/** One upstream step whose results a node reads. */
export type InputSource = {
  from: string
  pass: number
  /** Run-relative files the step recorded in `step_done`. */
  outputs?: readonly string[]
  /** A judge's verdict sent back along a loop edge. */
  role: "result" | "feedback"
}

/**
 * Upstream steps a node reads, in edge order (DES-034 data passing).
 * Judge and Approval are gates: a node after one reads the gated
 * results by reference, not copies. A judge's own verdict is read only
 * along a loop edge, as feedback for the node it sends back to.
 */
export function resolveInputSources(
  state: RunState,
  nodeId: string
): InputSource[] {
  const { nodes, edges } = state.graph
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]))
  const loops = findLoopEdges(nodes, edges)
  const out: InputSource[] = []
  const seen = new Set<string>()
  const gates = new Set<string>()

  /**
   * A direct input counts when its latest step is done. Behind a gate,
   * the source may already be running its next pass (the loop target
   * itself), so read its latest done pass: the one the gate saw.
   */
  const doneStep = (id: string, direct: boolean): StepState | undefined => {
    if (direct) {
      const step = latestStep(state.steps, id)
      return step?.status === "done" ? step : undefined
    }
    const list = state.steps.steps[id] ?? []
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]!.status === "done") return list[i]
    }
    return undefined
  }

  const add = (step: StepState, role: InputSource["role"]) => {
    const from = step.nodeId
    const key = `${role}:${from}:${step.pass}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      from,
      pass: step.pass,
      ...(step.outputs ? { outputs: step.outputs } : {}),
      role,
    })
  }

  const visit = (to: string, direct: boolean) => {
    edges.forEach((e, i) => {
      if (e.to !== to) return
      const step = doneStep(e.from, direct)
      if (!step) return
      if (e.branch !== undefined && e.branch !== step.branch) return
      if (!GATE_KINDS.has(kindOf.get(e.from) ?? "")) {
        add(step, "result")
        return
      }
      if (!gates.has(e.from)) {
        gates.add(e.from)
        visit(e.from, false)
      }
      if (direct && kindOf.get(e.from) === "judge" && loops.has(i)) {
        add(step, "feedback")
      }
    })
  }

  visit(nodeId, true)
  return out
}

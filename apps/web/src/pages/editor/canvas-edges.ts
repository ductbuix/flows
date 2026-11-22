import { findLoopEdges, type NodeWorkflow } from "@workspace/shared"
import type { Edge } from "@xyflow/react"
import { branchLabel } from "@/nodes/NodeFrame"

/** React Flow edges of a workflow: loop edges get the curved `loop` type (DES-034). */
export function canvasEdges(workflow: NodeWorkflow): Edge[] {
  const loops = findLoopEdges(workflow.nodes, workflow.edges)
  return workflow.edges.map((e, i) => {
    const base = {
      id: `edge-${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      sourceHandle: e.branch,
    }
    return loops.has(i)
      ? { ...base, type: "loop", data: { branch: e.branch } }
      : {
          ...base,
          label: e.branch ? branchLabel(e.branch) : undefined,
        }
  })
}

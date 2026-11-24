import { findLoopEdges, type Workflow } from "@workspace/contracts"

/**
 * YAML kinds the core host can execute (BL-194 / BL-195).
 * Loops, partial, retry and resume stay on the engine until BL-196.
 * Publish output stays on the engine until a connector publish port lands.
 * llm / agent / judge-rule need ACP inbox gates on the core actor before
 * they leave the engine path (permission/question/plan_review).
 */
const CORE_HOST_KINDS = new Set([
  "trigger",
  "command",
  "prompt",
  "asset",
  "approval",
])

/** Output targets ready on core. */
const CORE_OUTPUT_TARGETS = new Set(["notify", "folder"])

function nodeEligible(node: Workflow["nodes"][number]): boolean {
  if (node.kind === "output") {
    return node.target !== undefined && CORE_OUTPUT_TARGETS.has(node.target)
  }
  // Judge check is pure; rule mode needs ACP like llm.
  if (node.kind === "judge") return node.mode === "check"
  return CORE_HOST_KINDS.has(node.kind)
}

/** True when every node is on the core path and the graph has no loops. */
export function isCoreRunEligible(graph: Workflow): boolean {
  if (findLoopEdges(graph.nodes, graph.edges).size > 0) return false
  return graph.nodes.every(nodeEligible)
}

import type { Workflow } from "@workspace/contracts"

/**
 * YAML kinds the core host can execute (BL-194 / BL-195 / BL-196).
 * Loops, partial, retry and resume are on core as of BL-196.
 */
const CORE_HOST_KINDS = new Set([
  "trigger",
  "command",
  "prompt",
  "asset",
  "approval",
  "llm",
  "agent",
  "judge",
])

/** Output targets ready on core. */
const CORE_OUTPUT_TARGETS = new Set(["notify", "folder", "publish"])

function nodeEligible(node: Workflow["nodes"][number]): boolean {
  if (node.kind === "output") {
    return node.target !== undefined && CORE_OUTPUT_TARGETS.has(node.target)
  }
  return CORE_HOST_KINDS.has(node.kind)
}

/** True when every node kind is on the core path (loops included). */
export function isCoreRunEligible(graph: Workflow): boolean {
  return graph.nodes.every(nodeEligible)
}

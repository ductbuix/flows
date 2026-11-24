import type { Workflow } from "@workspace/contracts"

/** Kinds the core host can execute today (BL-194). BL-195 widens this. */
const CORE_HOST_KINDS = new Set(["trigger", "command"])

/** True when every node is on the core path (seam for BL-195). */
export function isCoreRunEligible(graph: Workflow): boolean {
  return graph.nodes.every((n) => CORE_HOST_KINDS.has(n.kind))
}

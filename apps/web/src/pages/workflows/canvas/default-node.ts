import type { NodeKindName, WorkflowNode } from "@workspace/contracts"

/** Minimal valid node record for Add node (BL-202). */
export function defaultNode(
  kind: NodeKindName,
  id: string
): Record<string, unknown> {
  switch (kind) {
    case "trigger":
      return { id, kind, type: "manual" }
    case "prompt":
      return { id, kind }
    case "asset":
      return { id, kind, resources: [] }
    case "agent":
      return { id, kind, cli: "claude" }
    case "command":
      return { id, kind, run: "echo ok" }
    case "llm":
      return { id, kind, cli: "claude" }
    case "judge":
      return { id, kind, mode: "rule", cli: "claude" }
    case "approval":
      return { id, kind, question: "Continue?" }
    case "output":
      return { id, kind, target: "notify", title: "Done" }
  }
}

/** Copy a parsed node for Duplicate (new id). */
export function cloneNodeRecord(
  node: WorkflowNode,
  id: string
): Record<string, unknown> {
  return { ...structuredClone(node), id }
}

export function newNodeId(kind: NodeKindName): string {
  return `${kind}-${Date.now().toString(36)}`
}

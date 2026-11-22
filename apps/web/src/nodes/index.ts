import { NODE_KINDS, type WorkflowNode } from "@workspace/shared"
import { agentView } from "./agent"
import { approvalView } from "./approval"
import { commandView } from "./command"
import type { NodeView } from "./define"
import { judgeView } from "./judge"
import { outputView } from "./output"
import { promptView } from "./prompt"
import { triggerView } from "./trigger"

export { defineNodeView } from "./define"
export type { NodeBodyProps, NodeView } from "./define"

/** The one list of node views; the canvas has no kind branches (DES-035). */
export const NODE_VIEWS: readonly NodeView[] = [
  triggerView,
  promptView,
  agentView,
  commandView,
  judgeView,
  approvalView,
  outputView,
] as unknown as readonly NodeView[]

export function viewOf(kind: string): NodeView | undefined {
  return NODE_VIEWS.find((v) => v.kind === kind)
}

/** Path of a node's text file (`nodes/<id>/prompt.md`), or null. */
export function nodeTextPath(node: Pick<WorkflowNode, "id" | "kind">): string | null {
  const file = NODE_KINDS.find((k) => k.kind === node.kind)?.files[0]
  return file ? `nodes/${node.id}/${file.path}` : null
}

/** Cards of steps are wider than cards of inputs and flow (DES-036). */
export function isStepKind(kind: string): boolean {
  return NODE_KINDS.find((k) => k.kind === kind)?.group === "steps"
}

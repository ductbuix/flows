import type { ComponentType } from "react"
import type { LucideIcon } from "lucide-react"
import type { WorkflowNode } from "@workspace/shared"

export type NodeOf<K extends WorkflowNode["kind"]> = Extract<
  WorkflowNode,
  { kind: K }
>

export type NodeBodyProps<N extends WorkflowNode = WorkflowNode> = {
  node: N
  /** Text of the kind's first node file (`prompt.md`, `text.md`), if it has one. */
  text: string
  /** Sets a YAML key on the node; `undefined` removes it. */
  onSetting: (key: string, value: unknown) => void
  /** Replaces the text of the kind's first node file. */
  onText: (text: string) => void
  /** Ends a run of typing, so the next edit is its own undo step. */
  onEditEnd: () => void
}

export type NodeView<K extends WorkflowNode["kind"] = WorkflowNode["kind"]> = {
  kind: K
  icon: LucideIcon
  Body: ComponentType<NodeBodyProps<NodeOf<K>>>
}

/** Registers how a kind looks on the canvas (DES-035 Web). */
export function defineNodeView<K extends WorkflowNode["kind"]>(
  def: NodeView<K>
): NodeView<K> {
  return def
}

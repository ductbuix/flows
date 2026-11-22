import { createContext, useContext, type ComponentType } from "react"
import type { WorkflowNode } from "@workspace/shared"
import type { Node, NodeProps } from "@xyflow/react"
import type { NodeBodyProps } from "./define"
import { NodeFrame } from "./NodeFrame"
import { isStepKind, viewOf } from "./index"

export type NodeCardData = { node: WorkflowNode; text: string }

/** What the cards call to edit the draft; the canvas provides it. */
export type NodeEdits = {
  setSetting: (id: string, key: string, value: unknown) => void
  setText: (id: string, text: string) => void
  endEdit: () => void
}

const noop: NodeEdits = {
  setSetting: () => {},
  setText: () => {},
  endEdit: () => {},
}

export const NodeEditsContext = createContext<NodeEdits>(noop)

/** The React Flow node type: the kind's `Body` inside the shared frame. */
export function NodeCard({ id, data, selected }: NodeProps<Node<NodeCardData>>) {
  const edits = useContext(NodeEditsContext)
  const view = viewOf(data.node.kind)
  if (!view) return null
  const Body = view.Body as ComponentType<NodeBodyProps>
  return (
    <NodeFrame
      id={id}
      name={data.node.name ?? data.node.id}
      icon={view.icon}
      wide={isStepKind(data.node.kind)}
      selected={selected}
    >
      <Body
        node={data.node}
        text={data.text}
        onSetting={(key, value) => edits.setSetting(id, key, value)}
        onText={(text) => edits.setText(id, text)}
        onEditEnd={edits.endEdit}
      />
    </NodeFrame>
  )
}

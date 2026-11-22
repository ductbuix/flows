import { createContext, useContext, type ComponentType } from "react"
import type { NodeRunView } from "@/pages/editor/node-run"
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
  openSettings: (id: string) => void
}

const noop: NodeEdits = {
  setSetting: () => {},
  setText: () => {},
  endEdit: () => {},
  openSettings: () => {},
}

export const NodeEditsContext = createContext<NodeEdits>(noop)

/** Live run state per node id, and Retry (BL-086); empty outside a run. */
export type NodeRunState = {
  views: Readonly<Record<string, NodeRunView>>
  retry: (id: string) => void
}

export const NodeRunContext = createContext<NodeRunState>({
  views: {},
  retry: () => {},
})

/** The React Flow node type: the kind's `Body` inside the shared frame. */
export function NodeCard({ id, data, selected }: NodeProps<Node<NodeCardData>>) {
  const edits = useContext(NodeEditsContext)
  const run = useContext(NodeRunContext)
  const live = run.views[id]
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
      status={live?.status}
      timer={live?.timer}
      result={live?.result}
      onRetry={() => run.retry(id)}
      onSettings={() => edits.openSettings(id)}
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

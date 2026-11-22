import { createContext, useContext, type ComponentType } from "react"
import type { NodeRunView } from "@/pages/editor/node-run"
import { PORT_TABLE, type WorkflowNode } from "@workspace/shared"
import type { Node, NodeProps } from "@xyflow/react"
import type { NodeBodyProps } from "./define"
import type { Decision } from "./decide"
import { NodeFrame, branchLabel } from "./NodeFrame"
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
  /** Run step: this node alone on the latest upstream results (BL-102). */
  runStep?: (id: string) => void
  /** Approve or Reject a waiting Approval step (BL-080). */
  decide?: (id: string, decision: Decision) => void
  /** The run view: no Retry, no settings, the body is not editable (BL-087). */
  readOnly?: boolean
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
      verdict={live?.verdict ? branchLabel(live.verdict) : undefined}
      pass={live?.pass}
      branches={PORT_TABLE[data.node.kind]?.branches}
      onDecide={
        run.decide ? (decision) => run.decide?.(id, decision) : undefined
      }
      onRun={
        run.readOnly || !run.runStep ? undefined : () => run.runStep?.(id)
      }
      onRetry={run.readOnly ? undefined : () => run.retry(id)}
      onSettings={run.readOnly ? undefined : () => edits.openSettings(id)}
    >
      <div inert={run.readOnly}>
        <Body
          node={data.node}
          text={data.text}
          onSetting={(key, value) => edits.setSetting(id, key, value)}
          onText={(text) => edits.setText(id, text)}
          onEditEnd={edits.endEdit}
        />
      </div>
    </NodeFrame>
  )
}

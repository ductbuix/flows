import { useMemo } from "react"
import type { Workflow } from "@workspace/shared"
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Connection,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Badge } from "@workspace/ui/components/badge"
import { buildEditorGraph, type EditorNodeData } from "./editor-graph-layout"

function EditorTaskNode({
  id,
  data,
  selected,
}: NodeProps<Node<EditorNodeData>>) {
  return (
    <div
      data-testid={`node-${id}`}
      className={`min-w-[160px] rounded-md border bg-card px-2 py-1.5 text-xs shadow-sm ${
        selected ? "ring-2 ring-ring" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="font-mono font-medium">{data.label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge variant="outline">{data.kind}</Badge>
        {data.markers.map((m) => (
          <Badge key={m} variant="secondary">
            {m}
          </Badge>
        ))}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { editorTask: EditorTaskNode }

type Props = {
  workflow: Workflow
  selectedTaskId?: string
  onSelectTask: (taskId: string | undefined) => void
  onConnect: (source: string, target: string) => void
}

export function EditorGraph({
  workflow,
  selectedTaskId,
  onSelectTask,
  onConnect,
}: Props) {
  const { nodes, edges } = useMemo(
    () => buildEditorGraph(workflow),
    [workflow]
  )
  const flowNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedTaskId,
      })),
    [nodes, selectedTaskId]
  )

  return (
    <div className="h-full min-h-[280px] w-full" data-testid="graph-canvas">
      <ReactFlow
        nodes={flowNodes}
        edges={edges.map((e) => ({
          ...e,
          data: undefined,
        }))}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable
        elementsSelectable
        fitView
        onNodeClick={(_e, node) => onSelectTask(node.id)}
        onPaneClick={() => onSelectTask(undefined)}
        onConnect={(c: Connection) => {
          if (c.source && c.target) onConnect(c.source, c.target)
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

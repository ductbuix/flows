import { useMemo } from "react"
import type { Workflow } from "@workspace/shared"
import {
  Background,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { MinusIcon, PlusIcon, ScanIcon } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@workspace/ui/components/button-group"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { buildEditorGraph, type EditorNodeData } from "./editor-graph-layout"

function EditorTaskNode({
  id,
  data,
  selected,
}: NodeProps<Node<EditorNodeData>>) {
  return (
    <Card
      size="sm"
      data-testid={`node-${id}`}
      className={cn(
        "min-w-40 overflow-visible shadow-sm",
        selected && "ring-2 ring-ring"
      )}
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
        {data.connections.map((connection) => (
          <Badge
            key={connection}
            variant="outline"
            data-testid={`node-connection-${id}-${connection}`}
          >
            {connection}
          </Badge>
        ))}
      </div>
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}

const nodeTypes = { editorTask: EditorTaskNode }

function GraphControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Panel position="bottom-left">
      <ButtonGroup data-testid="graph-controls">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Zoom out"
          onClick={() => void zoomOut()}
        >
          <MinusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Zoom in"
          onClick={() => void zoomIn()}
        >
          <PlusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Fit view"
          onClick={() => void fitView()}
        >
          <ScanIcon />
        </Button>
      </ButtonGroup>
    </Panel>
  )
}

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
  const { nodes, edges } = useMemo(() => buildEditorGraph(workflow), [workflow])
  const flowNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedTaskId,
      })),
    [nodes, selectedTaskId]
  )

  return (
    <div className="h-full min-h-70 w-full" data-testid="graph-canvas">
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
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        fitView
        onNodeClick={(_e, node) => onSelectTask(node.id)}
        onPaneClick={() => onSelectTask(undefined)}
        onConnect={(c: Connection) => {
          if (c.source && c.target) onConnect(c.source, c.target)
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <GraphControls />
      </ReactFlow>
    </div>
  )
}

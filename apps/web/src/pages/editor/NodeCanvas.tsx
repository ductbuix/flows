import { useEffect, useMemo } from "react"
import type { NodeWorkflow } from "@workspace/shared"
import {
  Background,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useNodesState,
  useReactFlow,
  type Edge,
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
import { placeNodes, type Pos } from "./node-canvas-layout"

type CardData = { label: string; kind: string }

/** Plain card per node; full kind cards come with BL-078. */
function NodeCard({ id, data, selected }: NodeProps<Node<CardData>>) {
  return (
    <Card
      size="sm"
      data-testid={`node-${id}`}
      className={cn("w-60 overflow-visible shadow-sm", selected && "ring-2 ring-ring")}
    >
      <Handle type="target" position={Position.Left} />
      <div className="text-sm font-medium">{data.label}</div>
      <div>
        <Badge variant="outline">{data.kind}</Badge>
      </div>
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}

const nodeTypes = { nodeCard: NodeCard }

function Controls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Panel position="bottom-left">
      <ButtonGroup data-testid="graph-controls">
        <Button type="button" variant="outline" aria-label="Zoom out" onClick={() => void zoomOut()}>
          <MinusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button type="button" variant="outline" aria-label="Zoom in" onClick={() => void zoomIn()}>
          <PlusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          type="button"
          variant="outline"
          aria-label="Fit view"
          onClick={() => void fitView({ maxZoom: 1 })}
        >
          <ScanIcon />
        </Button>
      </ButtonGroup>
    </Panel>
  )
}

type Props = {
  workflow: NodeWorkflow
  /** Positions loaded from the layout file. */
  saved: Readonly<Record<string, Pos>>
  /** Called on drag end with every node's position. */
  onPositions: (positions: Record<string, Pos>) => void
}

export function NodeCanvas({ workflow, saved, onPositions }: Props) {
  const initial = useMemo<Node<CardData>[]>(() => {
    const pos = placeNodes(workflow.nodes, workflow.edges, saved)
    return workflow.nodes.map((n) => ({
      id: n.id,
      type: "nodeCard",
      position: pos[n.id]!,
      data: { label: n.name ?? n.id, kind: n.kind },
    }))
  }, [workflow, saved])
  const [nodes, setNodes, onNodesChange] = useNodesState(initial)
  useEffect(() => setNodes(initial), [initial, setNodes])

  const edges = useMemo<Edge[]>(
    () =>
      workflow.edges.map((e, i) => ({
        id: `edge-${i}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        label: e.branch,
      })),
    [workflow.edges]
  )

  return (
    <div className="h-full min-h-70 w-full" data-testid="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        onNodeDragStop={(_e, _node, dragged) => {
          const moved = new Map(dragged.map((n) => [n.id, n.position]))
          onPositions(
            Object.fromEntries(
              nodes.map((n) => {
                const p = moved.get(n.id) ?? n.position
                return [n.id, { x: p.x, y: p.y }]
              })
            )
          )
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

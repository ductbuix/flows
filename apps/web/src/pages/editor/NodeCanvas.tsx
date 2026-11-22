import { useEffect, useMemo } from "react"
import type { Workflow } from "@workspace/shared"
import {
  Background,
  Panel,
  ReactFlow,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { MinusIcon, PlusIcon, ScanIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@workspace/ui/components/button-group"
import { toast } from "sonner"
import {
  NodeCard,
  NodeEditsContext,
  type NodeCardData,
  type NodeEdits,
} from "@/nodes/NodeCard"
import { nodeTextPath } from "@/nodes"
import { edgeTypes } from "@/nodes/LoopEdge"
import { placeNodes, type Pos } from "./node-canvas-layout"
import { canvasEdges } from "./canvas-edges"
import { wireRefusal } from "./node-add"
import type { WireSide } from "./node-add"

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
  workflow: Workflow
  /** Positions loaded from the layout file. */
  saved: Readonly<Record<string, Pos>>
  /** Edits of settings and node files, shown on the cards. */
  edits: NodeEdits
  /** Text of a node file by path (unsaved edit or disk). */
  textOf: (path: string) => string
  /** Called on drag end with every node's position. */
  onPositions: (positions: Record<string, Pos>) => void
  /** A checked wire between two nodes. */
  onWire: (edge: { from: string; to: string; branch?: string }) => void
  /** The selected node, or null (the Run menu runs from it). */
  onSelect?: (id: string | null) => void
  /** A wire dropped on empty canvas: where, and from which end. */
  onDrop: (drop: { wire: WireSide; client: Pos; flow: Pos }) => void
}

function pointOf(event: MouseEvent | TouchEvent): Pos {
  const p = "changedTouches" in event ? event.changedTouches[0]! : event
  return { x: p.clientX, y: p.clientY }
}

export function NodeCanvas({
  workflow,
  saved,
  edits,
  textOf,
  onPositions,
  onWire,
  onDrop,
  onSelect,
}: Props) {
  const { screenToFlowPosition } = useReactFlow()
  const initial = useMemo<Node<NodeCardData>[]>(() => {
    const pos = placeNodes(workflow.nodes, workflow.edges, saved)
    return workflow.nodes.map((n) => {
      const path = nodeTextPath(n)
      return {
        id: n.id,
        type: "nodeCard",
        position: pos[n.id]!,
        data: { node: n, text: path ? textOf(path) : "" },
      }
    })
  }, [workflow, saved, textOf])
  const [nodes, setNodes, onNodesChange] = useNodesState(initial)
  // Edits change data only: keep where the user put and selected each node.
  useEffect(
    () =>
      setNodes((prev) => {
        const old = new Map(prev.map((n) => [n.id, n]))
        return initial.map((n) => {
          const was = old.get(n.id)
          return was ? { ...was, data: n.data } : n
        })
      }),
    [initial, setNodes]
  )

  const edges = useMemo<Edge[]>(() => canvasEdges(workflow), [workflow])

  const onConnect = (c: Connection) => {
    const edge = {
      from: c.source,
      to: c.target,
      ...(c.sourceHandle ? { branch: c.sourceHandle } : {}),
    }
    const why = wireRefusal(workflow.nodes, workflow.edges, edge)
    if (why) toast.error(why)
    else onWire(edge)
  }

  const onConnectEnd = (
    event: MouseEvent | TouchEvent,
    state: FinalConnectionState
  ) => {
    if (state.isValid || state.toNode || !state.fromNode || !state.fromHandle) {
      return
    }
    const client = pointOf(event)
    onDrop({
      wire: {
        id: state.fromNode.id,
        handle: state.fromHandle.type === "source" ? "source" : "target",
        ...(state.fromHandle.id ? { branch: state.fromHandle.id } : {}),
      },
      client,
      flow: screenToFlowPosition(client),
    })
  }

  return (
    <div className="h-full min-h-70 w-full" data-testid="canvas">
      <NodeEditsContext.Provider value={edits}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onSelectionChange={({ nodes: picked }) =>
          onSelect?.(picked[0]?.id ?? null)
        }
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
      </NodeEditsContext.Provider>
    </div>
  )
}

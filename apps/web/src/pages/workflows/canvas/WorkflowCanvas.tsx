import { useEffect, useMemo, useRef } from "react"
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { LayoutFile, Workflow } from "@workspace/contracts"
import { FlowContext, type FlowActions } from "./flow-context"
import { canvasToLayout, workflowToCanvas, type CanvasNode } from "./flow-graph"
import { CanvasToolbar } from "./CanvasToolbar"
import { nodeTypes } from "./node-types"

type Props = {
  workflow: Workflow
  layout: LayoutFile
  onLayoutChange: (layout: LayoutFile) => void
}

const frameActions: FlowActions = {
  update: () => {},
  run: () => {},
  runAll: () => {},
  readOnly: true,
  duplicate: () => {},
  openSettings: () => {},
  remove: () => {},
}

/** Node canvas for a parsed workflow; drag updates layout via onLayoutChange. */
export function WorkflowCanvas({ workflow, layout, onLayoutChange }: Props) {
  const initial = useMemo(
    () => workflowToCanvas(workflow, layout),
    // Remount via key on the parent when the workflow id / yaml hash changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per mount
    []
  )
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, , onEdgesChange] = useEdgesState(initial.edges)
  const viewportRef = useRef<Viewport | undefined>(layout.viewport)
  const nodesRef = useRef(nodes)
  useEffect(() => {
    nodesRef.current = nodes
  })

  const publishLayout = (next: CanvasNode[]) => {
    onLayoutChange(
      canvasToLayout(
        next,
        viewportRef.current
          ? {
              x: viewportRef.current.x,
              y: viewportRef.current.y,
              zoom: viewportRef.current.zoom,
            }
          : layout.viewport
      )
    )
  }

  const onNodeDragStop: OnNodeDrag = (_e, _node, next) => {
    setNodes(next)
    publishLayout(next)
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-hidden rounded-3xl ring-1 ring-foreground/10"
      data-testid="workflow-canvas"
    >
      <FlowContext.Provider value={frameActions}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          defaultEdgeOptions={{
            style: {
              strokeDasharray: "6 6",
              stroke: "var(--muted-foreground)",
            },
          }}
          nodesConnectable={false}
          elementsSelectable
          selectionOnDrag
          panOnDrag={[1, 2]}
          panOnScroll
          zoomOnScroll={false}
          selectionMode={SelectionMode.Partial}
          onPaneContextMenu={(e) => e.preventDefault()}
          defaultViewport={layout.viewport ?? { x: 120, y: 150, zoom: 0.7 }}
          onMoveEnd={(_e, vp) => {
            viewportRef.current = vp
          }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            color="var(--muted-foreground)"
          />
          <CanvasToolbar />
        </ReactFlow>
      </FlowContext.Provider>
    </div>
  )
}

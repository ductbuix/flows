import { useEffect, useMemo, useRef, useState } from "react"
import {
  ConnectionLineType,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  type Viewport,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { LayoutFile, Workflow } from "@workspace/contracts"
import { FlowContext } from "./flow-context"
import { workflowToCanvas } from "./flow-graph"
import { CanvasChrome } from "./CanvasChrome"
import {
  CONNECTION_LINE_STYLE,
  DEFAULT_EDGE_OPTIONS,
  SELECTED_EDGE,
} from "./canvas-styles"
import { CanvasNodeLogs } from "./NodeLogDialog"
import { nodeTypes } from "./node-types"
import { useCanvasActions } from "./use-canvas-actions"
import { useCanvasConnect } from "./use-canvas-connect"
import { useCanvasKeys } from "./use-canvas-keys"
import { useCanvasOps } from "./use-canvas-ops"
import { useRunOverlay } from "./use-run-overlay"
import { useSystemPrompt } from "./use-system-prompt"

type History = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

type Props = {
  workflowId: string
  workflow: Workflow
  yaml: string
  layout: LayoutFile
  onYamlChange: (yaml: string) => void
  onLayoutChange: (layout: LayoutFile) => void
  history: History
  runView: string
  onRunView: (v: string) => void
}

/** Editable node canvas; YAML edits keep comments via contracts helpers. */
export function WorkflowCanvas({
  workflowId,
  workflow,
  yaml,
  layout,
  onYamlChange,
  onLayoutChange,
  history,
  runView,
  onRunView,
}: Props) {
  const initial = useMemo(
    () => workflowToCanvas(workflow, layout),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount seed
    []
  )
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const viewportRef = useRef<Viewport | undefined>(layout.viewport)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const system = useSystemPrompt(workflowId)
  const ops = useCanvasOps(
    yaml,
    layout,
    workflow,
    onYamlChange,
    onLayoutChange,
    (id) => setSettingsId((cur) => (cur === id ? null : cur))
  )
  const overlay = useRunOverlay(workflowId, nodes, runView, onRunView)

  useEffect(() => {
    const next = workflowToCanvas(workflow, layout)
    setNodes((prev) =>
      next.nodes.map((n) => ({
        ...n,
        selected: prev.find((p) => p.id === n.id)?.selected ?? false,
      }))
    )
    setEdges(next.edges)
  }, [workflow, layout, setNodes, setEdges])

  const { removeEdges, isValidConnection, onConnect, onNodeDragStop } =
    useCanvasConnect({
      workflow,
      layout,
      nodes,
      edges,
      setNodes,
      viewportRef,
      onLayoutChange,
      ops,
    })
  useCanvasKeys(
    nodes,
    edges,
    ops.duplicate,
    ops.remove,
    removeEdges,
    !overlay.readOnly
  )
  const editing = !overlay.readOnly
    ? workflow.nodes.find((n) => n.id === settingsId)
    : undefined

  const { runId } = overlay
  const [logNodeId, setLogNodeId] = useState<string | null>(null)
  const logNode = overlay.shown.find((n) => n.id === logNodeId)
  const actions = useCanvasActions({
    workflowId,
    workflow,
    ops,
    overlay,
    system,
    setSettingsId,
    setLogNodeId,
  })

  return (
    <div
      className="min-h-0 flex-1 overflow-hidden rounded-3xl ring-1 ring-foreground/10"
      data-testid="workflow-canvas"
    >
      <FlowContext.Provider value={actions}>
        <ReactFlow
          nodes={overlay.shown}
          edges={edges.map((e) =>
            e.selected ? { ...e, style: SELECTED_EDGE } : e
          )}
          nodeTypes={nodeTypes}
          onNodesChange={overlay.readOnly ? undefined : onNodesChange}
          onEdgesChange={overlay.readOnly ? undefined : onEdgesChange}
          onNodeDragStop={overlay.readOnly ? undefined : onNodeDragStop}
          onBeforeDelete={async ({ nodes: del, edges: ed }) => ({
            nodes: del.filter((n) => n.data.kind !== "trigger"),
            edges: ed,
          })}
          onNodesDelete={(del) => {
            for (const n of del) ops.remove(n.id)
          }}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          nodesDraggable={!overlay.readOnly}
          nodesConnectable={!overlay.readOnly}
          isValidConnection={isValidConnection}
          onConnect={onConnect}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionRadius={28}
          connectionLineStyle={CONNECTION_LINE_STYLE}
          edgesFocusable={!overlay.readOnly}
          elementsSelectable={!overlay.readOnly}
          selectionOnDrag={!overlay.readOnly}
          deleteKeyCode={null}
          panOnDrag={overlay.readOnly ? true : [1, 2]}
          panOnScroll
          zoomOnScroll={false}
          selectionMode={SelectionMode.Partial}
          onSelectionChange={({ nodes: sel }) =>
            setSettingsId((cur) =>
              cur && sel.some((n) => n.id === cur) ? cur : null
            )
          }
          onPaneContextMenu={(e) => e.preventDefault()}
          defaultViewport={layout.viewport ?? { x: 120, y: 150, zoom: 0.7 }}
          onMoveEnd={(_e, vp) => {
            viewportRef.current = vp
          }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <CanvasChrome
            workflow={workflow}
            editing={editing}
            systemText={system.text}
            saveSystem={system.save}
            onUpdate={ops.update}
            onCloseSettings={() => setSettingsId(null)}
            readOnly={overlay.readOnly}
            runs={overlay.runs}
            cards={overlay.cards}
            runView={runView}
            cardId={overlay.cardId}
            onRunView={onRunView}
            onCard={overlay.setCardId}
            onStart={() => void overlay.start()}
            viewing={overlay.viewing}
            starting={overlay.starting}
            history={history}
            onAdd={ops.add}
          />
        </ReactFlow>
      </FlowContext.Provider>
      {runId && logNode ? (
        <CanvasNodeLogs
          runId={runId}
          node={logNode}
          onClose={() => setLogNodeId(null)}
        />
      ) : null}
    </div>
  )
}

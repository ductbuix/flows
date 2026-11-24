import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
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
import { CanvasChrome } from "./CanvasChrome"
import { nodeTypes } from "./node-types"
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
    const canvas = next as CanvasNode[]
    setNodes(canvas)
    publishLayout(canvas)
  }

  const { load: loadSystem, clear: clearSystem } = system
  const openSettings = useCallback(
    (id: string) => {
      setSettingsId(id)
      const n = workflow.nodes.find((x) => x.id === id)
      if (n?.kind === "llm") loadSystem(id)
      else clearSystem()
    },
    [workflow.nodes, loadSystem, clearSystem]
  )

  useCanvasKeys(nodes, ops.duplicate, ops.remove, !overlay.readOnly)
  const editing = !overlay.readOnly
    ? workflow.nodes.find((n) => n.id === settingsId)
    : undefined

  const { readOnly, onRetry } = overlay
  const actions = useMemo<FlowActions>(
    () => ({
      update: ops.update,
      run: () => {},
      runAll: () => {},
      readOnly,
      duplicate: ops.duplicate,
      openSettings,
      remove: ops.remove,
      retry: onRetry ? (id) => void onRetry(id) : undefined,
    }),
    [ops.update, ops.duplicate, ops.remove, openSettings, readOnly, onRetry]
  )

  return (
    <div
      className="min-h-0 flex-1 overflow-hidden rounded-3xl ring-1 ring-foreground/10"
      data-testid="workflow-canvas"
    >
      <FlowContext.Provider value={actions}>
        <ReactFlow
          nodes={overlay.shown}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={overlay.readOnly ? undefined : onNodesChange}
          onEdgesChange={overlay.readOnly ? undefined : onEdgesChange}
          onNodeDragStop={overlay.readOnly ? undefined : onNodeDragStop}
          onBeforeDelete={async ({ nodes: del, edges: ed }) => ({
            nodes: del.filter((n) => n.type !== "trigger"),
            edges: ed,
          })}
          onNodesDelete={(del) => {
            for (const n of del) ops.remove(n.id)
          }}
          defaultEdgeOptions={{
            style: {
              strokeDasharray: "6 6",
              stroke: "var(--muted-foreground)",
            },
          }}
          nodesDraggable={!overlay.readOnly}
          nodesConnectable={false}
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
    </div>
  )
}

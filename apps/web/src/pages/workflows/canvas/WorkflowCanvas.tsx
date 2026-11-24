import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { NodeSettings } from "./NodeSettings"
import { nodeTypes } from "./node-types"
import { useCanvasOps } from "./use-canvas-ops"
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
  const {
    text: systemText,
    load: loadSystem,
    clear: clearSystem,
    save: saveSystem,
  } = useSystemPrompt(workflowId)

  const ops = useCanvasOps(
    yaml,
    layout,
    workflow,
    onYamlChange,
    onLayoutChange,
    (id) => setSettingsId((cur) => (cur === id ? null : cur))
  )

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
    setNodes(next)
    publishLayout(next)
  }

  const openSettings = useCallback(
    (id: string) => {
      setSettingsId(id)
      const n = workflow.nodes.find((x) => x.id === id)
      if (n?.kind === "llm") loadSystem(id)
      else clearSystem()
    },
    [workflow.nodes, loadSystem, clearSystem]
  )

  const { duplicate, remove } = ops
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement
      if (el.closest("input, textarea, [contenteditable=true]")) return
      const selected = nodes.filter((n) => n.selected).map((n) => n.id)
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "d") {
        ev.preventDefault()
        selected.forEach((id) => duplicate(id))
        return
      }
      if (ev.key === "Backspace" || ev.key === "Delete") {
        if (selected.length === 0) return
        ev.preventDefault()
        selected.forEach((id) => remove(id))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [nodes, duplicate, remove])

  const editing = workflow.nodes.find((n) => n.id === settingsId)

  const actions = useMemo<FlowActions>(
    () => ({
      update: ops.update,
      run: () => {},
      runAll: () => {},
      readOnly: false,
      duplicate: ops.duplicate,
      openSettings,
      remove: ops.remove,
    }),
    [ops.update, ops.duplicate, ops.remove, openSettings]
  )

  return (
    <div
      className="min-h-0 flex-1 overflow-hidden rounded-3xl ring-1 ring-foreground/10"
      data-testid="workflow-canvas"
    >
      <FlowContext.Provider value={actions}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
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
          nodesConnectable={false}
          elementsSelectable
          selectionOnDrag
          panOnDrag={[1, 2]}
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
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            color="var(--muted-foreground)"
          />
          {editing ? (
            <NodeSettings
              key={editing.id}
              node={editing}
              systemPrompt={systemText}
              onSystemPrompt={
                editing.kind === "llm"
                  ? (text) => saveSystem(editing.id, text)
                  : undefined
              }
              onChange={(patch) => ops.update(editing.id, patch)}
              onClose={() => setSettingsId(null)}
            />
          ) : null}
          <CanvasToolbar
            hasTrigger={workflow.nodes.some((n) => n.kind === "trigger")}
            onAdd={ops.add}
            history={history}
          />
        </ReactFlow>
      </FlowContext.Provider>
    </div>
  )
}

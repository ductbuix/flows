import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router"
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Page } from "@/components/page"
import { FlowContext, type FlowActions } from "./flow-context"
import {
  newData,
  type FlowData,
  type FlowNode,
  type NodeKind,
} from "./flow-data"
import { nodeTypes, portOf } from "./flow-node-types"
import { Toolbar } from "./FlowToolbar"
import { useDraftRun } from "./useDraftRun"
import { useEditorOps } from "./useEditorOps"
import { NodeSettings } from "./NodeSettings"
import { RunBar } from "./RunBar"
import { nodeStatesFor } from "./run-view"
import { decideRun, startRun, useRuns } from "./runs-store"
import {
  getFlow,
  saveFlow,
  setWorkflowInputs,
  useWorkflows,
} from "./workflows-store"

/** Remounts per workflow so each canvas starts from its saved state. */
export function WorkflowEditorMock() {
  const { id = "" } = useParams()
  return <Editor key={id} id={id} />
}

function Editor({ id }: { id: string }) {
  const workflow = useWorkflows().find((w) => w.id === id)
  const [initial] = useState(() => getFlow(id))
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(
    initial.nodes
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [params] = useSearchParams()
  const [view, setView] = useState(params.get("run") ?? "draft")
  const [cardId, setCardId] = useState<string | null>(null)
  const runs = useRuns().filter((r) => r.workflowId === id)
  const viewing = runs.find((r) => r.id === view) ?? null
  const shown = useMemo(() => {
    if (!viewing) return nodes
    const states = nodeStatesFor(viewing, nodes, edges)
    return nodes.map((n) => ({
      ...n,
      className: "pointer-events-none",
      data: {
        ...n.data,
        state: states[n.id]?.state,
        result: states[n.id]?.result,
      },
    }))
  }, [viewing, nodes, edges])
  useEffect(() => saveFlow(id, { nodes, edges }), [id, nodes, edges])
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const editing = nodes.find((n) => n.id === settingsId && n.selected)
  const ops = useEditorOps(nodes, edges, setNodes, setEdges, !viewing)
  const seq = useRef(1)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  })

  const update = useCallback(
    (nid: string, patch: Partial<FlowData>) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nid ? { ...n, data: { ...n.data, ...patch } } : n
        )
      )
      // An asset changing type drops wires its new output cannot feed.
      if (patch.assetKind) {
        const out = patch.assetKind === "image" ? "image" : "text"
        setEdges((prev) =>
          prev.filter(
            (e) =>
              e.source !== nid ||
              e.targetHandle === "any" ||
              portOf(e.targetHandle) === out
          )
        )
      }
    },
    [setNodes, setEdges]
  )

  const sourceType = (c: { source: string; sourceHandle?: string | null }) => {
    const n = nodesRef.current.find((x) => x.id === c.source)
    if (n?.type === "asset")
      return n.data.assetKind === "markdown" ? "text" : "image"
    return portOf(c.sourceHandle)
  }

  const { run, runAll } = useDraftRun(nodesRef, edgesRef, update)

  const actions = useMemo<FlowActions>(
    () => ({
      update,
      run: (x) => void run(x),
      runAll: () => void runAll(),
      readOnly: !!viewing,
      duplicate: ops.duplicate,
      openSettings: setSettingsId,
      remove: ops.remove,
      decide: viewing ? (d) => decideRun(viewing.id, d) : undefined,
    }),
    [update, run, runAll, viewing, ops.duplicate, ops.remove]
  )

  function add(kind: NodeKind) {
    const last = nodesRef.current.at(-1)
    setNodes((prev) => [
      ...prev,
      {
        id: `${kind}-${seq.current++}`,
        type: kind,
        position: {
          x: (last?.position.x ?? 0) + 80,
          y: (last?.position.y ?? 0) + 380,
        },
        data: newData(kind),
      },
    ])
  }

  const BRANCH: Record<string, string> = { yes: "Yes", no: "No" }
  const onConnect = (c: Connection) =>
    setEdges((prev) =>
      addEdge({ ...c, label: BRANCH[c.sourceHandle ?? ""] }, prev)
    )

  return (
    <Page
      fill
      crumbs={[
        { label: "Mockup", to: "/mock" },
        { label: "Workflows", to: "/mock/workflows" },
        { label: workflow?.name ?? id },
      ]}
      data-testid="mock-workflow-editor"
    >
      <div className="min-h-0 flex-1 overflow-hidden rounded-3xl ring-1 ring-foreground/10">
        <FlowContext.Provider value={actions}>
          <ReactFlow
            nodes={shown}
            edges={edges}
            nodeTypes={nodeTypes}
            onBeforeDelete={async ({ nodes: del, edges: ed }) => ({
              nodes: del.filter((n) => n.type !== "trigger"),
              edges: ed,
            })}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={(c) =>
              c.targetHandle === "any" ||
              sourceType(c) === portOf(c.targetHandle)
            }
            defaultEdgeOptions={{
              style: {
                strokeDasharray: "6 6",
                stroke: "var(--muted-foreground)",
              },
            }}
            nodesDraggable={!viewing}
            nodesConnectable={!viewing}
            elementsSelectable={!viewing}
            selectionOnDrag={!viewing}
            // Left drag selects, right drag or two fingers pan, pinch zooms.
            panOnDrag={viewing ? true : [1, 2]}
            panOnScroll
            zoomOnScroll={false}
            selectionMode={SelectionMode.Partial}
            // Settings follow the selection: deselecting the node hides the panel.
            onSelectionChange={({ nodes: sel }) =>
              setSettingsId((cur) =>
                cur && sel.some((n) => n.id === cur) ? cur : null
              )
            }
            onPaneContextMenu={(e) => e.preventDefault()}
            defaultViewport={{ x: 120, y: 150, zoom: 0.7 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              color="var(--muted-foreground)"
            />
            {editing && !viewing ? (
              <NodeSettings
                key={editing.id}
                node={editing}
                inputs={workflow?.inputs ?? []}
                onInputs={(v) => setWorkflowInputs(id, v)}
                onChange={(p) => update(editing.id, p)}
                onClose={() => setSettingsId(null)}
              />
            ) : null}
            <RunBar
              runs={runs}
              value={viewing ? view : "draft"}
              cardId={cardId}
              onValue={setView}
              onCard={setCardId}
              onStart={() => {
                if (!cardId) return
                setView(startRun(id, cardId).id)
              }}
            />
            <Toolbar
              hasTrigger={nodes.some((n) => n.type === "trigger")}
              onAdd={add}
              history={ops}
            />
          </ReactFlow>
        </FlowContext.Provider>
      </div>
    </Page>
  )
}

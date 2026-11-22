import { useEffect, useMemo, useState } from "react"
import { runCanvasSchema, type RunCanvas, type RunDetail } from "@workspace/shared"
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { api } from "@/lib/api"
import { decideStep, type Decision } from "@/nodes/decide"
import { NodeCard, NodeRunContext, type NodeCardData } from "@/nodes/NodeCard"
import { branchLabel } from "@/nodes/NodeFrame"
import { nodeTextPath } from "@/nodes"
import { formatElapsed, nodeStatus, verdictsOf, type NodeRunView } from "@/pages/editor/node-run"
import { placeNodes } from "@/pages/editor/node-canvas-layout"

const nodeTypes = { nodeCard: NodeCard }

type Props = {
  run: RunDetail
  selectedTaskId?: string
  onSelectTask: (nodeId: string) => void
}

const noRetry = () => {}

/** Graph tab of a node run: frozen layout, read-only node cards (BL-087). */
export function NodeRunGraph({ run, selectedTaskId, onSelectTask }: Props) {
  const [canvas, setCanvas] = useState<RunCanvas | null>(null)
  const runId = run.id
  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.runs[":runId"].canvas.$get({ param: { runId } })
      if (alive && res.ok) setCanvas(runCanvasSchema.parse(await res.json()))
    })()
    return () => {
      alive = false
    }
  }, [runId])

  const nodes = useMemo<Node<NodeCardData>[]>(() => {
    if (!canvas) return []
    const { workflow, layout, texts } = canvas
    const pos = placeNodes(workflow.nodes, workflow.edges, layout.nodes)
    return workflow.nodes.map((n) => {
      const path = nodeTextPath(n)
      return {
        id: n.id,
        type: "nodeCard",
        position: pos[n.id]!,
        selected: n.id === selectedTaskId,
        data: { node: n, text: path ? (texts[path] ?? "") : "" },
      }
    })
  }, [canvas, selectedTaskId])

  const edges = useMemo<Edge[]>(
    () =>
      (canvas?.workflow.edges ?? []).map((e, i) => ({
        id: `edge-${i}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        sourceHandle: e.branch,
        label: e.branch ? branchLabel(e.branch) : undefined,
      })),
    [canvas]
  )

  const state = useMemo(() => {
    const views: Record<string, NodeRunView> = {}
    const verdicts = verdictsOf(run.steps)
    for (const s of run.steps ?? []) {
      const status = nodeStatus(s.status)
      if (!status) continue
      const end = s.endedAt ? Date.parse(s.endedAt) : Date.now()
      views[s.nodeId] = {
        status,
        ...(verdicts[s.nodeId] ? { verdict: verdicts[s.nodeId] } : {}),
        ...(s.startedAt
          ? { timer: formatElapsed(end - Date.parse(s.startedAt)) }
          : {}),
      }
    }
    return {
      views,
      retry: noRetry,
      decide: (id: string, decision: Decision) =>
        decideStep(run.id, id, decision),
      readOnly: true,
    }
  }, [run.steps, run.id])

  return (
    <div className="h-full min-h-80 w-full" data-testid="run-graph">
      <NodeRunContext.Provider value={state}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          onNodeClick={(_e, node) => onSelectTask(node.id)}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </NodeRunContext.Provider>
    </div>
  )
}

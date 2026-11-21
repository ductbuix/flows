import dagre from "@dagrejs/dagre"
import type { Edge, Node } from "@xyflow/react"
import { needTaskId, type Need, type Workflow } from "@workspace/shared"

const NODE_W = 180
const NODE_H = 80

function needLabel(need: Need): string | undefined {
  if (typeof need === "string") return undefined
  if (need.when) return "when"
  return undefined
}

export type EditorNodeData = {
  label: string
  kind: string
  markers: string[]
  connections: string[]
}

export function buildEditorGraph(workflow: Workflow): {
  nodes: Node<EditorNodeData>[]
  edges: Edge[]
} {
  const nodes: Node<EditorNodeData>[] = workflow.tasks.map((task) => {
    const markers: string[] = []
    if (task.kind === "agent" && task.spawn) markers.push("spawn")
    if (task.retry) markers.push("retry")
    if (task.repeat) markers.push("repeat")
    if (task.when !== undefined) markers.push("when")
    if (task.approval) markers.push("approval")
    const connections = (task.uses ?? []).map((u) => u.connection)
    return {
      id: task.id,
      type: "editorTask",
      position: { x: 0, y: 0 },
      data: {
        label: task.name ?? task.id,
        kind: task.kind,
        markers,
        connections,
      },
      draggable: false,
      selectable: true,
    }
  })

  const edges: Edge[] = []
  for (const task of workflow.tasks) {
    for (const need of task.needs ?? []) {
      const source = needTaskId(need)
      edges.push({
        id: `edge-${source}-${task.id}`,
        source,
        target: task.id,
        label: needLabel(need),
        selectable: true,
      })
    }
  }

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 60 })
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }
  dagre.layout(g)

  return {
    nodes: nodes.map((node) => {
      const pos = g.node(node.id)
      return {
        ...node,
        position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      }
    }),
    edges,
  }
}

import dagre from "@dagrejs/dagre"
import type { Edge, Node } from "@xyflow/react"
import type { RunDetail } from "@workspace/shared"
import { needTaskId, type Need } from "@workspace/shared"

const NODE_W = 180
const NODE_H = 72

function needLabel(need: Need): string | undefined {
  if (typeof need === "string") return undefined
  if (need.when) return "when"
  return undefined
}

export function buildTaskGraph(run: RunDetail): {
  nodes: Node[]
  edges: Edge[]
} {
  const taskMap = new Map(run.tasks.map((t) => [t.id, t]))
  const nodes: Node[] = run.graph.tasks.map((spec) => {
    const view = taskMap.get(spec.id)
    return {
      id: spec.id,
      type: "task",
      position: { x: 0, y: 0 },
      data: {
        label: spec.id,
        status: view?.status ?? "pending",
        attempts: view?.attempts.length ?? 0,
        spawned: view?.spawned ?? false,
      },
      draggable: false,
      selectable: true,
    }
  })

  const edges: Edge[] = []
  for (const spec of run.graph.tasks) {
    for (const need of spec.needs ?? []) {
      const source = needTaskId(need)
      const label = needLabel(need)
      edges.push({
        id: `${source}->${spec.id}`,
        source,
        target: spec.id,
        label,
        selectable: false,
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

  const laidOut = nodes.map((node) => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - NODE_W / 2,
        y: pos.y - NODE_H / 2,
      },
    }
  })

  return { nodes: laidOut, edges }
}

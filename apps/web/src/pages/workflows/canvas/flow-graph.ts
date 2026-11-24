import Dagre from "@dagrejs/dagre"
import type { Edge, Node } from "@xyflow/react"
import {
  PORT_TABLE,
  type LayoutFile,
  type Workflow,
  type WorkflowEdge,
  type WorkflowNode,
} from "@workspace/contracts"
import type { CanvasNodeData } from "./flow-kinds"

export type CanvasNode = Node<CanvasNodeData, string>
export type CanvasEdge = Edge

const NODE_W = 280
const NODE_H = 120
const BRANCH_LABEL: Record<string, string> = { yes: "Yes", no: "No" }

function summaryOf(node: WorkflowNode): string | undefined {
  switch (node.kind) {
    case "trigger":
      return "Manual"
    case "command":
      return node.run
    case "approval":
      return node.question
    case "output":
      return node.title ?? node.target
    case "asset":
      return `${node.access ?? "read"} · ${node.resources.length} resources`
    case "judge":
      return node.mode === "check" ? "Check" : "Rule"
    case "agent":
    case "llm":
      return node.cli
    case "prompt":
      return node.name
    default:
      return undefined
  }
}

function dataOf(node: WorkflowNode): CanvasNodeData {
  return {
    kind: node.kind,
    name: node.name,
    summary: summaryOf(node),
    question: node.kind === "approval" ? node.question : undefined,
    title: node.kind === "output" ? node.title : undefined,
  }
}

function edgeId(e: WorkflowEdge): string {
  return `${e.from}-${e.branch ?? e.port ?? "text"}-${e.to}-${e.port ?? "text"}`
}

export function workflowEdgesToCanvas(
  edges: readonly WorkflowEdge[]
): CanvasEdge[] {
  return edges.map((e) => {
    const port = e.port ?? "text"
    return {
      id: edgeId(e),
      source: e.from,
      target: e.to,
      sourceHandle: e.branch ?? port,
      targetHandle: port,
      label: e.branch ? (BRANCH_LABEL[e.branch] ?? e.branch) : undefined,
    }
  })
}

/** Positions from layout; missing ids get dagre next to their inputs. */
export function workflowToCanvas(
  workflow: Workflow,
  layout: LayoutFile
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const placed = new Map(
    Object.entries(layout.nodes).map(([id, p]) => [id, { x: p.x, y: p.y }])
  )
  const missing = workflow.nodes.filter((n) => !placed.has(n.id))
  if (missing.length > 0) {
    for (const [id, pos] of dagrePositions(workflow, placed)) {
      if (!placed.has(id)) placed.set(id, pos)
    }
  }

  const nodes: CanvasNode[] = workflow.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: placed.get(n.id) ?? { x: 0, y: 0 },
    data: dataOf(n),
  }))

  return { nodes, edges: workflowEdgesToCanvas(workflow.edges) }
}

function dagrePositions(
  workflow: Workflow,
  known: Map<string, { x: number; y: number }>
): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "LR", nodesep: 48, ranksep: 80 })
  for (const n of workflow.nodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H })
  }
  for (const e of workflow.edges) {
    if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to)
  }
  Dagre.layout(g)
  const out = new Map<string, { x: number; y: number }>()
  for (const n of workflow.nodes) {
    if (known.has(n.id)) continue
    const pos = g.node(n.id)
    if (!pos) continue
    out.set(n.id, {
      x: pos.x - NODE_W / 2,
      y: pos.y - NODE_H / 2,
    })
  }
  return out
}

/** Layout file from the current canvas node positions (+ optional viewport). */
export function canvasToLayout(
  nodes: readonly { id: string; position: { x: number; y: number } }[],
  viewport?: LayoutFile["viewport"]
): LayoutFile {
  const layout: LayoutFile = {
    version: 1,
    nodes: Object.fromEntries(
      nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }])
    ),
  }
  if (viewport) layout.viewport = viewport
  return layout
}

export function portsFor(kind: string) {
  return PORT_TABLE[kind] ?? { in: ["text"] as const, out: ["text"] as const }
}

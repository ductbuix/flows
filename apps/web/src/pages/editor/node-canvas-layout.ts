import dagre from "@dagrejs/dagre"

export const NODE_W = 240
export const NODE_H = 96
const GAP_X = 60
const GAP_Y = 40

export type Pos = { x: number; y: number }

function overlaps(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H
}

/**
 * Positions for every node (top-left). Saved positions win. A node with no
 * saved position goes right of its placed inputs, moved down until it clears
 * other nodes; a node with no placed input takes its dagre slot (DES-036).
 */
export function placeNodes(
  nodes: readonly { id: string }[],
  edges: readonly { from: string; to: string }[],
  saved: Readonly<Record<string, Pos>>
): Record<string, Pos> {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "LR", nodesep: GAP_Y, ranksep: GAP_X })
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H })
  for (const e of edges) {
    if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to)
  }
  dagre.layout(g)
  const slot = (id: string): Pos => {
    const p = g.node(id)
    return { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 }
  }

  const out: Record<string, Pos> = {}
  for (const n of nodes) {
    const s = saved[n.id]
    if (s) out[n.id] = { x: s.x, y: s.y }
  }
  const hasSaved = Object.keys(out).length > 0
  let pending = nodes.filter((n) => !out[n.id])
  while (pending.length > 0) {
    const next: typeof pending = []
    let progressed = false
    for (const n of pending) {
      const inputs = edges
        .filter((e) => e.to === n.id && e.from !== n.id && out[e.from])
        .map((e) => out[e.from]!)
      if (!hasSaved || inputs.length === 0) {
        next.push(n)
        continue
      }
      const right = inputs.reduce((a, b) => (b.x > a.x ? b : a))
      const pos = { x: right.x + NODE_W + GAP_X, y: right.y }
      while (Object.values(out).some((o) => overlaps(o, pos))) {
        pos.y += NODE_H + GAP_Y
      }
      out[n.id] = pos
      progressed = true
    }
    if (!progressed) {
      for (const n of next) out[n.id] = slot(n.id)
      break
    }
    pending = next
  }
  return out
}

/**
 * Where a node added from the toolbar lands: right of the selected node, else
 * right of the rightmost one, else the origin. Moves down past other nodes.
 */
export function nextSlot(
  nodes: readonly { position: Pos; selected?: boolean }[]
): Pos {
  if (nodes.length === 0) return { x: 0, y: 0 }
  const anchor =
    nodes.find((n) => n.selected) ??
    nodes.reduce((a, b) => (b.position.x > a.position.x ? b : a))
  const pos = { x: anchor.position.x + NODE_W + GAP_X, y: anchor.position.y }
  while (nodes.some((n) => overlaps(n.position, pos))) pos.y += NODE_H + GAP_Y
  return pos
}

import type { WorkflowEdge } from "./index.ts"

type LoopNode = { id: string; kind?: string }

/**
 * Indexes of the loop edges (DES-034, Loops): self edges, and in each cycle
 * the edges from inside into the cycle's entry node. A depth-first walk from
 * the sources finds them: an edge into a node still on the stack closes a
 * cycle. Ties go by node order in `workflow.yaml`, never by canvas position.
 */
export function findLoopEdges(
  nodes: readonly LoopNode[],
  edges: readonly Pick<WorkflowEdge, "from" | "to">[]
): Set<number> {
  const order = new Map(nodes.map((n, i) => [n.id, i]))
  const out = new Map<string, number[]>(nodes.map((n) => [n.id, []]))
  const hasIn = new Set<string>()
  edges.forEach((e, i) => {
    if (!order.has(e.from) || !order.has(e.to)) return
    out.get(e.from)!.push(i)
    hasIn.add(e.to)
  })
  for (const list of out.values()) {
    list.sort(
      (a, b) =>
        order.get(edges[a]!.to)! - order.get(edges[b]!.to)! || a - b
    )
  }

  const loops = new Set<number>()
  const state = new Map<string, "stack" | "done">()
  const visit = (id: string) => {
    state.set(id, "stack")
    for (const i of out.get(id)!) {
      const to = edges[i]!.to
      const s = state.get(to)
      if (s === "stack") loops.add(i)
      else if (s === undefined) visit(to)
    }
    state.set(id, "done")
  }
  for (const n of nodes) if (!hasIn.has(n.id) && !state.has(n.id)) visit(n.id)
  // Cycles no source reaches: the first node in file order is the entry.
  for (const n of nodes) if (!state.has(n.id)) visit(n.id)
  return loops
}

/** One warning per loop edge whose cycle holds no Judge to end it. */
export function loopWarnings(
  nodes: readonly LoopNode[],
  edges: readonly WorkflowEdge[]
): { index: number; message: string }[] {
  const loops = findLoopEdges(nodes, edges)
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]))
  const forward = new Map<string, string[]>()
  const back = new Map<string, string[]>()
  edges.forEach((e, i) => {
    if (loops.has(i)) return
    forward.set(e.from, [...(forward.get(e.from) ?? []), e.to])
    back.set(e.to, [...(back.get(e.to) ?? []), e.from])
  })
  const reach = (start: string, adj: Map<string, string[]>) => {
    const seen = new Set([start])
    const todo = [start]
    while (todo.length > 0) {
      for (const next of adj.get(todo.pop()!) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          todo.push(next)
        }
      }
    }
    return seen
  }
  const out: { index: number; message: string }[] = []
  for (const i of [...loops].sort((a, b) => a - b)) {
    const e = edges[i]!
    const down = reach(e.to, forward)
    const up = reach(e.from, back)
    const cycle = [...down].filter((id) => up.has(id))
    if (!cycle.some((id) => kindOf.get(id) === "judge")) {
      out.push({
        index: i,
        message: `loop ${e.from} -> ${e.to} has no Judge to end it; it stops only at the loop limit`,
      })
    }
  }
  return out
}

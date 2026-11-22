import { PORT_TABLE, type WorkflowEdge } from "@workspace/shared"

const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}.`

/** Why `edge` cannot join `edges`: port type, branch or duplicate. */
export function edgeProblemsFor(
  nodes: readonly { id: string; kind: string }[],
  edges: readonly WorkflowEdge[],
  edge: WorkflowEdge
): string | null {
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]))
  const fromKind = kindOf.get(edge.from)
  const toKind = kindOf.get(edge.to)
  if (!fromKind || !toKind) return "That node no longer exists."
  const port = edge.port ?? "text"
  const from = PORT_TABLE[fromKind]!
  const to = PORT_TABLE[toKind]!
  if (from.branches) {
    if (!edge.branch || !from.branches.includes(edge.branch)) {
      return sentence(
        `an edge out of ${fromKind} needs a branch: ${from.branches.join(" or ")}`
      )
    }
  } else if (edge.branch !== undefined) {
    return sentence(`${fromKind} has no branches`)
  }
  if (!from.branches && !from.out.includes(port)) {
    return sentence(`${fromKind} has no ${port} output`)
  }
  if (!to.in.includes(port)) return sentence(`${toKind} has no ${port} input`)
  const dup = edges.some(
    (e) =>
      e.from === edge.from &&
      e.to === edge.to &&
      (e.port ?? "text") === port &&
      (e.branch ?? "") === (edge.branch ?? "")
  )
  if (dup) return "Those nodes are already connected."
  return null
}

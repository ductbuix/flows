import {
  PORT_TABLE,
  addEdge,
  addNode,
  edgeSchema,
  parseNodeWorkflowYaml,
  type WorkflowEdge,
} from "@workspace/shared"
import { edgeProblemsFor } from "./node-wire"

export type WireSide = {
  /** Existing node the wire was dragged from. */
  id: string
  /** `source`: the new node takes the wire's output; `target`: its input. */
  handle: "source" | "target"
  /** Judge branch of the dragged handle (`yes` or `no`). */
  branch?: string
}

/** Smallest valid node of a kind; the user edits the rest in the node. */
export function defaultNode(
  kind: string,
  id: string
): Record<string, unknown> {
  switch (kind) {
    case "trigger":
      return { id, kind, type: "manual" }
    case "agent":
      return { id, kind, cli: "claude" }
    case "judge":
      return { id, kind, cli: "claude" }
    case "command":
      return { id, kind, run: 'echo "hello"' }
    case "approval":
      return { id, kind, question: "Continue?" }
    case "output":
      return { id, kind, target: "folder" }
    default:
      return { id, kind }
  }
}

/** `kind`, then `kind-2`, `kind-3`, ... until the id is free. */
export function freeNodeId(kind: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(kind)) return kind
  for (let n = 2; ; n++) {
    if (!used.has(`${kind}-${n}`)) return `${kind}-${n}`
  }
}

/** Kinds that can sit at the open end of a wire on `port`. */
export function kindsForWire(
  handle: "source" | "target",
  port: "text" | "file" = "text"
): string[] {
  return Object.entries(PORT_TABLE)
    .filter(([, p]) =>
      handle === "source" ? p.in.includes(port) : p.out.includes(port)
    )
    .map(([kind]) => kind)
}

export type AddResult = { yaml: string; id: string }

/** Adds a node, and the edge when it was dropped from a wire. */
export function yamlAfterAddNode(
  yaml: string,
  kind: string,
  wire?: WireSide
): AddResult {
  const ids = (parseNodeWorkflowYaml(yaml).workflow?.nodes ?? []).map(
    (n) => n.id
  )
  const id = freeNodeId(kind, ids)
  let next = addNode(yaml, defaultNode(kind, id))
  if (wire) {
    const edge: WorkflowEdge =
      wire.handle === "source"
        ? { from: wire.id, to: id, ...(wire.branch ? { branch: wire.branch } : {}) }
        : { from: id, to: wire.id }
    next = addEdge(next, edgeSchema.parse(edge))
  }
  return { yaml: next, id }
}

/** The three-node sample of the empty state: Trigger, Agent, Output. */
export function yamlAfterSample(yaml: string): string {
  let next = yaml
  const ids: string[] = []
  for (const kind of ["trigger", "agent", "output"]) {
    const added = yamlAfterAddNode(next, kind)
    next = added.yaml
    ids.push(added.id)
  }
  next = addEdge(next, { from: ids[0]!, to: ids[1]! })
  return addEdge(next, { from: ids[1]!, to: ids[2]! })
}

/** First reason a new edge is refused, or null when it is fine. */
export function wireRefusal(
  nodes: readonly { id: string; kind: string }[],
  edges: readonly WorkflowEdge[],
  edge: WorkflowEdge
): string | null {
  if (edge.from === edge.to) return "A node cannot connect to itself."
  return edgeProblemsFor(nodes, edges, edge)
}

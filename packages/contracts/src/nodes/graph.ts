import { z } from "zod"
import type { PortType } from "./define.ts"
import { NODE_KINDS, type WorkflowNode } from "./kinds.ts"

export const portTypeSchema = z.enum(["text", "file"])

export const edgeSchema = z.strictObject({
  from: z.string().min(1),
  to: z.string().min(1),
  port: portTypeSchema.optional(),
  branch: z.string().min(1).optional(),
})

export type WorkflowEdge = z.infer<typeof edgeSchema>

export type NodePorts = {
  in: readonly PortType[]
  out: readonly PortType[]
  branches?: readonly string[]
}

/** The port table: kind name to its ports. */
export const PORT_TABLE: Record<string, NodePorts> = Object.fromEntries(
  NODE_KINDS.map((k) => [
    k.kind,
    { in: k.ports.in, out: k.ports.out, branches: k.branches },
  ])
)

/** Problems with edges against nodes; one message each. */
export function edgeProblems(
  nodes: readonly { id: string; kind: string }[],
  edges: readonly WorkflowEdge[]
): { index: number; message: string }[] {
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]))
  const seen = new Set<string>()
  const out: { index: number; message: string }[] = []
  edges.forEach((e, index) => {
    const add = (message: string) => out.push({ index, message })
    const fromKind = kindOf.get(e.from)
    const toKind = kindOf.get(e.to)
    if (!fromKind) add(`unknown node id ${e.from}`)
    if (!toKind) add(`unknown node id ${e.to}`)
    const port = e.port ?? "text"
    if (fromKind) {
      const p = PORT_TABLE[fromKind]!
      if (p.branches) {
        if (!e.branch || !p.branches.includes(e.branch)) {
          add(`edge out of ${fromKind} needs branch ${p.branches.join(" or ")}`)
        }
      } else if (e.branch !== undefined) {
        add(`branch is not allowed on edges out of ${fromKind}`)
      }
      if (!p.branches && !p.out.includes(port)) {
        add(`${fromKind} has no out port ${port}`)
      }
    }
    if (toKind && !PORT_TABLE[toKind]!.in.includes(port)) {
      add(`${toKind} has no in port ${port}`)
    }
    const key = `${e.from}|${e.to}|${port}|${e.branch ?? ""}`
    if (seen.has(key)) add("duplicate edge")
    seen.add(key)
  })
  return out
}

/** Ids of every node with a path to `id`, along any port. */
function ancestorsOf(edges: readonly WorkflowEdge[], id: string): Set<string> {
  const seen = new Set<string>()
  const todo = [id]
  while (todo.length > 0) {
    const at = todo.pop()!
    for (const e of edges) {
      if (e.to === at && !seen.has(e.from)) {
        seen.add(e.from)
        todo.push(e.from)
      }
    }
  }
  return seen
}

/** Connections an Asset with `propose` access offers upstream of a node (BL-084). */
export function proposeConnectionsUpstream(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  nodeId: string
): string[] {
  const up = ancestorsOf(edges, nodeId)
  const found = new Set<string>()
  for (const a of nodes) {
    if (a.kind !== "asset" || a.access !== "propose" || !up.has(a.id)) continue
    for (const r of a.resources) found.add(r.connection)
  }
  return [...found].sort()
}

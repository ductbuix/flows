import { PORT_TABLE, type WorkflowEdge } from "@workspace/shared"
import { latestStep, type StepsState } from "./fold-steps.ts"

/** The part of a node workflow the walk reads. */
export type WalkGraph = {
  nodes: readonly { id: string; kind: string }[]
  edges: readonly WorkflowEdge[]
}

/** What a run covers. `trigger` is the trigger the run started from. */
export type WalkScope = { trigger: string }

export type WalkAction =
  /** `inputs`: source node ids of the active edges, in edge file order. */
  | { type: "run"; nodeId: string; pass: number; inputs: string[] }
  | { type: "skip"; nodeId: string; pass: number }

type Eff =
  | { s: "none" } // inert: never due in this run
  | { s: "open" } // running, waiting, pending, or about to run or wait
  | { s: "done"; branch?: string }
  | { s: "ended" } // failed, cancelled or skipped: no active output

/** Forward order: topological, ties by node order. Throws on a cycle. */
export function forwardOrder(graph: WalkGraph): string[] {
  const ids = graph.nodes.map((n) => n.id)
  const known = new Set(ids)
  const indegree = new Map(ids.map((id) => [id, 0]))
  for (const e of graph.edges) {
    if (!known.has(e.from) || !known.has(e.to)) {
      throw new Error(`edge ${e.from} -> ${e.to} names an unknown node`)
    }
    indegree.set(e.to, indegree.get(e.to)! + 1)
  }
  const order: string[] = []
  const placed = new Set<string>()
  while (order.length < ids.length) {
    const next = ids.find((id) => !placed.has(id) && indegree.get(id) === 0)
    if (next === undefined) {
      const left = ids.filter((id) => !placed.has(id))
      throw new Error(
        `workflow has a cycle through ${left.join(", ")}; loops are not supported yet`
      )
    }
    placed.add(next)
    order.push(next)
    for (const e of graph.edges) {
      if (e.from === next) indegree.set(e.to, indegree.get(e.to)! - 1)
    }
  }
  return order
}

function stepEff(steps: StepsState, nodeId: string): Eff | undefined {
  const step = latestStep(steps, nodeId)
  // A pending step was reset by a manual retry: due again, as if new.
  if (!step || step.status === "pending") return undefined
  if (step.status === "done") return { s: "done", branch: step.branch }
  if (step.status === "failed" || step.status === "skipped") return { s: "ended" }
  if (step.status === "cancelled") return { s: "ended" }
  return { s: "open" }
}

/**
 * Pure walk (DES-034): the actions due now for a forward graph.
 * Nodes with no in port (trigger, prompt) start the run; only the
 * trigger named in `scope` runs. Skips flow on within the same call.
 */
export function nextActions(
  graph: WalkGraph,
  scope: WalkScope,
  steps: StepsState
): WalkAction[] {
  const order = forwardOrder(graph)
  const kindOf = new Map(graph.nodes.map((n) => [n.id, n.kind]))
  const eff = new Map<string, Eff>()
  const actions: WalkAction[] = []

  for (const id of order) {
    const existing = stepEff(steps, id)
    if (existing) {
      eff.set(id, existing)
      continue
    }
    const kind = kindOf.get(id)!
    const isSource = (PORT_TABLE[kind]?.in.length ?? 0) === 0
    if (isSource) {
      if (kind === "trigger" && id !== scope.trigger) {
        eff.set(id, { s: "none" })
      } else {
        actions.push({ type: "run", nodeId: id, pass: 1, inputs: [] })
        eff.set(id, { s: "open" })
      }
      continue
    }

    const incoming = graph.edges.filter((e) => e.to === id)
    const states = incoming.map((e) => eff.get(e.from) ?? { s: "none" })
    if (states.some((st) => st.s === "open")) {
      eff.set(id, { s: "open" }) // join waits; so does what follows
      continue
    }
    if (states.every((st) => st.s === "none")) {
      eff.set(id, { s: "none" })
      continue
    }
    const active = incoming.filter((e) => {
      const st = eff.get(e.from)
      return (
        st?.s === "done" && (e.branch === undefined || e.branch === st.branch)
      )
    })
    if (active.length === 0) {
      actions.push({ type: "skip", nodeId: id, pass: 1 })
      eff.set(id, { s: "ended" })
    } else {
      actions.push({
        type: "run",
        nodeId: id,
        pass: 1,
        inputs: active.map((e) => e.from),
      })
      eff.set(id, { s: "open" })
    }
  }
  return actions
}

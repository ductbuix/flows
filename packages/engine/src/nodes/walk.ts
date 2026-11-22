import {
  DEFAULT_LOOP_PASSES,
  PORT_TABLE,
  findLoopEdges,
  type WorkflowEdge,
} from "@workspace/shared"
import { latestStep, type StepState, type StepsState } from "./fold-steps.ts"

/** The part of a node workflow the walk reads. */
export type WalkGraph = {
  nodes: readonly { id: string; kind: string }[]
  edges: readonly WorkflowEdge[]
}

/** What a run covers. `trigger` is the trigger the run started from. */
export type WalkScope = {
  trigger: string
  /** Partial run: only this node runs; seeded steps are its inputs (BL-102). */
  only?: string
  /** Passes a node may run before it fails with `loop_limit`; default 5. */
  loopPasses?: number
}

export type WalkAction =
  /** `inputs`: source node ids of the active edges, in edge file order. */
  | { type: "run"; nodeId: string; pass: number; inputs: string[] }
  | { type: "skip"; nodeId: string; pass: number }
  /** Pass `loopPasses + 1` is not started: the node fails (DES-034, Loops). */
  | { type: "fail"; nodeId: string; pass: number; reason: "loop_limit" }

type Eff =
  | { s: "none" } // inert: never due in this run
  | { s: "open" } // running, waiting, pending, or about to run or wait
  | { s: "done"; branch?: string }
  | { s: "ended" } // failed, cancelled or skipped: no active output

/**
 * Forward order: topological over the forward edges (loop edges removed),
 * ties by node order in the file.
 */
export function forwardOrder(graph: WalkGraph): string[] {
  const ids = graph.nodes.map((n) => n.id)
  const known = new Set(ids)
  const loops = findLoopEdges(graph.nodes, graph.edges)
  const indegree = new Map(ids.map((id) => [id, 0]))
  graph.edges.forEach((e, i) => {
    if (!known.has(e.from) || !known.has(e.to)) {
      throw new Error(`edge ${e.from} -> ${e.to} names an unknown node`)
    }
    if (!loops.has(i)) indegree.set(e.to, indegree.get(e.to)! + 1)
  })
  const order: string[] = []
  const placed = new Set<string>()
  while (order.length < ids.length) {
    const next = ids.find((id) => !placed.has(id) && indegree.get(id) === 0)
    if (next === undefined) throw new Error("loop edges left a cycle")
    placed.add(next)
    order.push(next)
    graph.edges.forEach((e, i) => {
      if (e.from === next && !loops.has(i)) {
        indegree.set(e.to, indegree.get(e.to)! - 1)
      }
    })
  }
  return order
}

function terminalEff(step: StepState): Eff {
  return step.status === "done" ? { s: "done", branch: step.branch } : { s: "ended" }
}

/** A done step whose branch the edge takes. */
function feeds(e: WorkflowEdge, step: StepState | undefined): step is StepState {
  return (
    step?.status === "done" &&
    (e.branch === undefined || e.branch === step.branch)
  )
}

/**
 * Pure walk (DES-034): the actions due now. Nodes with no in port
 * (trigger, prompt) start the run; only the trigger named in `scope`
 * runs. Skips flow on within the same call. A finished node runs again
 * (the next pass) when an active input, forward or loop, has a newer
 * result than its latest step.
 */
export function nextActions(
  graph: WalkGraph,
  scope: WalkScope,
  steps: StepsState
): WalkAction[] {
  const order = forwardOrder(graph)
  const loops = findLoopEdges(graph.nodes, graph.edges)
  const limit = scope.loopPasses ?? DEFAULT_LOOP_PASSES
  const kindOf = new Map(graph.nodes.map((n) => [n.id, n.kind]))
  const eff = new Map<string, Eff>()
  const actions: WalkAction[] = []

  for (const id of order) {
    const latest = latestStep(steps, id)
    const kind = kindOf.get(id)!
    // Run step: the other nodes only hold the results copied in.
    if (scope.only !== undefined && id !== scope.only) {
      eff.set(id, latest ? terminalEff(latest) : { s: "none" })
      continue
    }
    const isSource = (PORT_TABLE[kind]?.in.length ?? 0) === 0
    const incoming = graph.edges
      .map((e, i) => ({ e, loop: loops.has(i) }))
      .filter((x) => x.e.to === id)
    const forward = incoming.filter((x) => !x.loop).map((x) => x.e)

    // A pending step was reset by a manual retry: due again, as if new.
    let pass = latest ? latest.pass : 1
    if (latest && latest.status !== "pending") {
      if (latest.status === "running" || latest.status === "waiting") {
        eff.set(id, { s: "open" })
        continue
      }
      const stale = forward.some((e) => eff.get(e.from)?.s === "open")
      // A self edge feeds the node's own finished pass back to it.
      const newer = incoming.some(({ e }) => {
        const src = latestStep(steps, e.from)
        // Steps copied from an earlier run are not newer than each other.
        if (latest.reused && src?.reused) return false
        return feeds(e, src) && (e.from === id || src.seq > latest.seq)
      })
      if (stale || !newer || isSource) {
        eff.set(id, stale && !isSource ? { s: "open" } : terminalEff(latest))
        continue
      }
      // A skipped pass is replaced; a finished one is followed by the next.
      pass = latest.status === "skipped" ? latest.pass : latest.pass + 1
    }

    if (isSource) {
      if (kind === "trigger" && id !== scope.trigger) {
        eff.set(id, { s: "none" })
      } else {
        actions.push({ type: "run", nodeId: id, pass, inputs: [] })
        eff.set(id, { s: "open" })
      }
      continue
    }

    const states = forward.map((e) => eff.get(e.from) ?? { s: "none" })
    if (states.some((st) => st.s === "open")) {
      eff.set(id, { s: "open" }) // join waits; so does what follows
      continue
    }
    if (states.every((st) => st.s === "none")) {
      eff.set(id, { s: "none" })
      continue
    }
    const active = incoming.filter(({ e, loop }) => {
      if (loop) return feeds(e, latestStep(steps, e.from))
      const st = eff.get(e.from)
      return (
        st?.s === "done" && (e.branch === undefined || e.branch === st.branch)
      )
    })
    if (active.length === 0) {
      actions.push({ type: "skip", nodeId: id, pass })
      eff.set(id, { s: "ended" })
    } else if (pass > limit) {
      actions.push({ type: "fail", nodeId: id, pass, reason: "loop_limit" })
      eff.set(id, { s: "ended" })
    } else {
      actions.push({
        type: "run",
        nodeId: id,
        pass,
        inputs: active.map((x) => x.e.from),
      })
      eff.set(id, { s: "open" })
    }
  }
  return actions
}

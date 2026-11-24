import type { EngineEvent, Workflow } from "@workspace/contracts"
import { forwardOrder } from "./walk.ts"
import { latestStep, type StepState, type StepsState } from "./model.ts"

/** Partial run request (DES-034, BL-102). */
export type PartialRun = {
  only?: string
  from?: string
  /** Earlier node runs of the workflow, newest first. */
  bases: readonly string[]
}

export type PartialBase = {
  runId: string
  graph: Workflow
  steps: StepsState
  /** A Run step run holds only some nodes: no base for Run from here. */
  stepRun: boolean
}

export type SeedCopy = {
  fromRunId: string
  nodeId: string
  pass: number
}

export type PartialSeedPlan = {
  copies: SeedCopy[]
  events: EngineEvent[]
}

/** Key order must not matter when two copies of a node are compared. */
export function canon(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : 1
          )
        )
      : v
  )
}

/** Every node reachable from `id` over any edge, `id` included. */
export function downstreamOf(graph: Workflow, id: string): Set<string> {
  const seen = new Set([id])
  const queue = [id]
  while (queue.length > 0) {
    const cur = queue.pop()!
    for (const e of graph.edges) {
      if (e.from === cur && !seen.has(e.to)) {
        seen.add(e.to)
        queue.push(e.to)
      }
    }
  }
  return seen
}

/** The graph apart from its nodes and edges: shared defaults and limits. */
export function shell(graph: Workflow): string {
  const rest: Record<string, unknown> = {
    ...(graph as Workflow & Record<string, unknown>),
  }
  delete rest.nodes
  delete rest.edges
  return canon(rest)
}

/** Why a partial run cannot start, or undefined. */
export function partialRefusal(
  graph: Workflow,
  partial: Pick<PartialRun, "only" | "from">
): string | undefined {
  const target = partial.only ?? partial.from
  if (target === undefined) return undefined
  if (partial.only !== undefined && partial.from !== undefined) {
    return "Use only or from, not both"
  }
  if (!graph.nodes.some((n) => n.id === target)) {
    return `Unknown node ${target}`
  }
  return undefined
}

type SeedStep = { base: PartialBase; step: StepState }

/** The latest done step of each node `only` reads, from the newest run with one. */
export function onlySeeds(
  graph: Workflow,
  only: string,
  bases: readonly PartialBase[]
): SeedStep[] {
  const sources = [
    ...new Set(graph.edges.filter((e) => e.to === only).map((e) => e.from)),
  ]
  return sources.map((source) => {
    for (const base of bases) {
      const step = latestStep(base.steps, source)
      if (step?.status === "done") return { base, step }
    }
    throw new Error(`Run ${source} first: it has no result to read yet`)
  })
}

function toEvents(
  runId: string,
  at: string,
  seeds: SeedStep[]
): PartialSeedPlan {
  const copies: SeedCopy[] = []
  const events: EngineEvent[] = []
  for (const { base, step } of seeds) {
    copies.push({
      fromRunId: base.runId,
      nodeId: step.nodeId,
      pass: step.pass,
    })
    if (step.status === "done") {
      events.push({
        type: "step_done",
        runId,
        at,
        nodeId: step.nodeId,
        pass: step.pass,
        outputs: step.outputs ?? [],
        ...(step.branch ? { branch: step.branch } : {}),
        ...(step.answer ? { answer: step.answer } : {}),
        reused: true,
      } as EngineEvent)
    } else {
      events.push({
        type: "step_skipped",
        runId,
        at,
        nodeId: step.nodeId,
        pass: step.pass,
        reused: true,
      })
    }
  }
  return { copies, events }
}

/**
 * Plan reused step events for a partial run (no I/O).
 * `unchanged` decides whether a `from` node can be reused.
 */
export function planPartialSeed(options: {
  runId: string
  at: string
  graph: Workflow
  partial: PartialRun
  bases: readonly PartialBase[]
  unchanged: (base: PartialBase, nodeId: string) => boolean
}): PartialSeedPlan {
  const { runId, at, graph, partial, bases, unchanged } = options
  const refusal = partialRefusal(graph, partial)
  if (refusal) throw new Error(refusal)

  if (partial.only !== undefined) {
    return toEvents(runId, at, onlySeeds(graph, partial.only, bases))
  }

  const base = bases.find((b) => !b.stepRun)
  if (!base || partial.from === undefined) return { copies: [], events: [] }
  const rerun = downstreamOf(graph, partial.from)
  if (shell(graph) !== shell(base.graph)) return { copies: [], events: [] }
  const reusable = new Set<string>()
  const sameInputs = (id: string) =>
    graph.edges.filter((e) => e.to === id).every((e) => reusable.has(e.from))
  const seeds: SeedStep[] = []
  for (const id of forwardOrder(graph)) {
    if (rerun.has(id)) continue
    const step = latestStep(base.steps, id)
    if (step?.status !== "done" && step?.status !== "skipped") continue
    if (!unchanged(base, id)) continue
    if (!sameInputs(id)) continue
    reusable.add(id)
    seeds.push({ base, step })
  }
  return toEvents(runId, at, seeds)
}

/** Throws when a partial `only` has nothing to build on. */
export function assertPartialReady(options: {
  graph: Workflow
  partial: PartialRun
  bases: readonly PartialBase[]
}): void {
  const refusal = partialRefusal(options.graph, options.partial)
  if (refusal) throw new Error(refusal)
  if (options.partial.only === undefined) return
  onlySeeds(options.graph, options.partial.only, options.bases)
}

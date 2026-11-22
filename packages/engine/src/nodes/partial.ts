import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  workflowSchema,
  type EngineEvent,
  type Workflow,
} from "@workspace/shared"
import type { EventLog } from "../event-log.ts"
import { runDir, workflowDir } from "../paths.ts"
import { forwardOrder } from "./walk.ts"
import { foldSteps, latestStep, type StepState } from "./fold-steps.ts"
import { stepDir } from "./step-paths.ts"

/** Partial run request (DES-034, Partial runs; BL-102). */
export type PartialRun = {
  only?: string
  from?: string
  /** Earlier node runs of the workflow, newest first; the base goes first. */
  bases: readonly string[]
}

const now = () => new Date().toISOString()

type Base = {
  runId: string
  root: string
  graph: Workflow
  steps: ReturnType<typeof foldSteps>
  /** A Run step run holds only some nodes: no base for Run from here. */
  stepRun: boolean
}

function loadBase(
  log: EventLog,
  home: string,
  workflowId: string,
  runId: string
): Base | undefined {
  const events = log.listByRun(runId).map((s) => s.event)
  const started = events.find((e) => e.type === "run_started")
  if (!started || started.type !== "run_started") return undefined
  if (!("nodes" in (started.graph as object))) return undefined
  return {
    runId,
    root: runDir(workflowDir(home, workflowId), runId),
    graph: workflowSchema.parse(started.graph) as Workflow,
    steps: foldSteps(events),
    stepRun: started.only !== undefined,
  }
}

/** Key order must not matter when two copies of a node are compared. */
function canon(value: unknown): string {
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

function dirSnapshot(dir: string, rel = "", out: Record<string, string> = {}) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) dirSnapshot(abs, `${rel}${name}/`, out)
    else out[`${rel}${name}`] = readFileSync(abs).toString("base64")
  }
  return out
}

/** Every node reachable from `id` over any edge, `id` included. */
function downstreamOf(graph: Workflow, id: string): Set<string> {
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
function shell(graph: Workflow): string {
  const { nodes: _n, edges: _e, ...rest } = graph as Workflow & Record<string, unknown>
  return canon(rest)
}

/** Whether a node's settings, files and incoming edges match the base run. */
function unchanged(
  graph: Workflow,
  runRoot: string,
  base: Base,
  nodeId: string
): boolean {
  const mine = graph.nodes.find((n) => n.id === nodeId)
  const theirs = base.graph.nodes.find((n) => n.id === nodeId)
  if (!mine || !theirs || canon(mine) !== canon(theirs)) return false
  const into = (g: Workflow) =>
    canon(g.edges.filter((e) => e.to === nodeId))
  if (into(graph) !== into(base.graph)) return false
  const frozen = (root: string) =>
    dirSnapshot(join(root, "nodes", nodeId, "frozen"))
  return canon(frozen(runRoot)) === canon(frozen(base.root))
}

/** Copies one finished step of `base` into the new run and logs it as reused. */
function seedStep(
  log: EventLog,
  runId: string,
  runRoot: string,
  base: Base,
  step: StepState
) {
  if (step.status === "done") {
    const from = stepDir(base.root, step.nodeId, step.pass)
    const to = stepDir(runRoot, step.nodeId, step.pass)
    if (existsSync(from)) {
      mkdirSync(dirname(to), { recursive: true })
      // Asset steps link into the base run's pins: copy what they point at.
      cpSync(from, to, { recursive: true, dereference: true })
    }
    log.append({
      type: "step_done",
      runId,
      at: now(),
      nodeId: step.nodeId,
      pass: step.pass,
      outputs: step.outputs ?? [],
      ...(step.branch ? { branch: step.branch } : {}),
      ...(step.answer ? { answer: step.answer } : {}),
      reused: true,
    } as EngineEvent)
  } else {
    log.append({
      type: "step_skipped",
      runId,
      at: now(),
      nodeId: step.nodeId,
      pass: step.pass,
      reused: true,
    })
  }
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

/** The latest done step of each node `only` reads, from the newest run with one. */
function onlySeeds(
  graph: Workflow,
  only: string,
  bases: readonly Base[]
): { base: Base; step: StepState }[] {
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

/** Throws before the run starts when a partial run has nothing to build on. */
export function assertPartialReady(options: {
  log: EventLog
  home: string
  workflowId: string
  graph: Workflow
  partial: PartialRun
}): void {
  const { log, home, workflowId, graph, partial } = options
  const refusal = partialRefusal(graph, partial)
  if (refusal) throw new Error(refusal)
  if (partial.only === undefined) return
  const bases = partial.bases
    .map((id) => loadBase(log, home, workflowId, id))
    .filter((b): b is Base => b !== undefined)
  onlySeeds(graph, partial.only, bases)
}

/**
 * Copies the results a partial run builds on, as `step_done` events marked
 * `reused`, before the first tick.
 *
 * - `only`: the latest done step of each node the target reads, from the
 *   newest run that has one.
 * - `from`: every node outside the target and what follows it whose
 *   settings, files and inputs match the base run, and that its inputs
 *   also reuse.
 */
export function seedPartialRun(options: {
  log: EventLog
  home: string
  workflowId: string
  runId: string
  graph: Workflow
  partial: PartialRun
}): void {
  const { log, home, workflowId, runId, graph, partial } = options
  const runRoot = runDir(workflowDir(home, workflowId), runId)
  const bases = partial.bases
    .filter((id) => id !== runId)
    .map((id) => loadBase(log, home, workflowId, id))
    .filter((b): b is Base => b !== undefined)

  if (partial.only !== undefined) {
    for (const { base, step } of onlySeeds(graph, partial.only, bases)) {
      seedStep(log, runId, runRoot, base, step)
    }
    return
  }

  const base = bases.find((b) => !b.stepRun)
  if (!base || partial.from === undefined) return
  const rerun = downstreamOf(graph, partial.from)
  if (shell(graph) !== shell(base.graph)) return
  const reusable = new Set<string>()
  const sameInputs = (id: string) =>
    graph.edges.filter((e) => e.to === id).every((e) => reusable.has(e.from))
  for (const id of forwardOrder(graph)) {
    if (rerun.has(id)) continue
    const step = latestStep(base.steps, id)
    if (step?.status !== "done" && step?.status !== "skipped") continue
    if (!unchanged(graph, runRoot, base, id)) continue
    // A loop edge from a node that runs again is not the same input.
    if (!sameInputs(id)) continue
    reusable.add(id)
    seedStep(log, runId, runRoot, base, step)
  }
}

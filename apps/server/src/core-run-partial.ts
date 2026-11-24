import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs"
import { dirname, join } from "node:path"
import {
  workflowSchema,
  type EngineEvent,
  type Workflow,
} from "@workspace/contracts"
import {
  assertPartialReady,
  canon,
  foldAllSteps,
  planPartialSeed,
  type PartialBase,
  type PartialRun,
} from "@workspace/core"
import { runDir, workflowDir, type Host } from "@workspace/adapters-node"

function dirSnapshot(
  dir: string,
  rel = "",
  out: Record<string, string> = {}
): Record<string, string> {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) dirSnapshot(abs, `${rel}${name}/`, out)
    else out[`${rel}${name}`] = readFileSync(abs).toString("base64")
  }
  return out
}

function loadBase(
  engine: Host,
  workflowId: string,
  runId: string
): PartialBase | undefined {
  const events = engine.events(runId)
  const started = events.find((e) => e.type === "run_started")
  if (!started || started.type !== "run_started") return undefined
  if (!("nodes" in (started.graph as object))) return undefined
  return {
    runId,
    graph: workflowSchema.parse(started.graph) as Workflow,
    steps: foldAllSteps(events),
    stepRun: started.only !== undefined,
  }
}

function unchanged(
  home: string,
  workflowId: string,
  runRoot: string,
  graph: Workflow,
  base: PartialBase,
  nodeId: string
): boolean {
  const mine = graph.nodes.find((n) => n.id === nodeId)
  const theirs = base.graph.nodes.find((n) => n.id === nodeId)
  if (!mine || !theirs || canon(mine) !== canon(theirs)) return false
  const into = (g: Workflow) => canon(g.edges.filter((e) => e.to === nodeId))
  if (into(graph) !== into(base.graph)) return false
  const frozen = (root: string) =>
    dirSnapshot(join(root, "nodes", nodeId, "frozen"))
  const baseRoot = runDir(workflowDir(home, workflowId), base.runId)
  return canon(frozen(runRoot)) === canon(frozen(baseRoot))
}

/**
 * Assert readiness, copy reused step folders, return seed events for
 * `run_started` (BL-196 / DES-034).
 */
export function seedCorePartial(options: {
  engine: Host
  graph: Workflow
  runId: string
  at: string
  partial: PartialRun
}): EngineEvent[] {
  const { engine, graph, runId, at, partial } = options
  const bases = partial.bases
    .filter((id) => id !== runId)
    .map((id) => loadBase(engine, graph.id, id))
    .filter((b): b is PartialBase => b !== undefined)

  assertPartialReady({ graph, partial, bases })

  const runRoot = runDir(workflowDir(engine.home, graph.id), runId)
  const plan = planPartialSeed({
    runId,
    at,
    graph,
    partial,
    bases,
    unchanged: (base, nodeId) =>
      unchanged(engine.home, graph.id, runRoot, graph, base, nodeId),
  })

  for (const copy of plan.copies) {
    const from = join(
      runDir(workflowDir(engine.home, graph.id), copy.fromRunId),
      "nodes",
      copy.nodeId,
      `pass-${copy.pass}`
    )
    const to = join(runRoot, "nodes", copy.nodeId, `pass-${copy.pass}`)
    if (existsSync(from)) {
      mkdirSync(dirname(to), { recursive: true })
      cpSync(from, to, { recursive: true, dereference: true })
    }
  }
  return plan.events
}

/** Copy the input folder of the first base that has one into the new run. */
export function copyPartialInput(options: {
  home: string
  workflowId: string
  runId: string
  bases: readonly string[]
}): void {
  const wfRoot = workflowDir(options.home, options.workflowId)
  const runRoot = runDir(wfRoot, options.runId)
  const input = join(runRoot, "input")
  mkdirSync(input, { recursive: true })
  const inputBase = options.bases
    .map((id) => join(runDir(wfRoot, id), "input"))
    .find((p) => existsSync(p))
  if (inputBase) {
    cpSync(inputBase, input, { recursive: true })
  }
}

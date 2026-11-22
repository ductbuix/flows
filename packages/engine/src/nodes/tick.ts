import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import {
  nodeWorkflowSchema,
  type EngineEvent,
  type NodeWorkflow,
} from "@workspace/shared"
import type { EventLog } from "../event-log.ts"
import { runDir, workflowDir } from "../paths.ts"
import type { ExecContext, ExecInput } from "./define.ts"
import { foldSteps, latestStep, type StepsState } from "./fold-steps.ts"
import { executorFor } from "./registry.ts"
import { frozenDir, stepDir } from "./step-paths.ts"
import { nextActions } from "./walk.ts"

export type NodeRunOptions = {
  log: EventLog
  home: string
  runId: string
  /** Test hook: throw to simulate a crash at a point (DES-034). */
  crashAt?: (point: "after_step_started" | "after_act", nodeId: string) => void
}

export type StartNodeRunOptions = Omit<NodeRunOptions, "crashAt"> & {
  graph: NodeWorkflow
  /** Trigger to start from; default is the first trigger node. */
  trigger?: string
  /** Run input text, frozen as `input/text.md`. */
  inputText?: string
  crashAt?: NodeRunOptions["crashAt"]
}

const now = () => new Date().toISOString()

/**
 * Freezes the graph, the node files and the run input, appends
 * `run_started`, then ticks until the run settles (DES-034).
 */
export function startNodeRun(opts: StartNodeRunOptions): StepsState {
  const { log, home, runId, graph } = opts
  const wfRoot = workflowDir(home, graph.id)
  const runRoot = runDir(wfRoot, runId)
  mkdirSync(runRoot, { recursive: true })
  writeFileSync(join(runRoot, "graph.json"), JSON.stringify(graph, null, 2))

  const input = join(runRoot, "input")
  mkdirSync(input, { recursive: true })
  if (existsSync(join(wfRoot, "input"))) {
    cpSync(join(wfRoot, "input"), input, { recursive: true })
  }
  if (opts.inputText !== undefined) {
    writeFileSync(join(input, "text.md"), opts.inputText)
  }

  for (const node of graph.nodes) {
    const src = join(wfRoot, "nodes", node.id)
    if (existsSync(src)) {
      cpSync(src, frozenDir(runRoot, node.id), { recursive: true })
    }
  }

  const trigger =
    opts.trigger ?? graph.nodes.find((n) => n.kind === "trigger")?.id
  log.append({
    type: "run_started",
    runId,
    at: now(),
    workflowId: graph.id,
    graph: graph as never,
    ...(trigger ? { trigger } : {}),
  })
  return tickNodes(opts)
}

function runStarted(events: readonly EngineEvent[]) {
  const e = events.find((x) => x.type === "run_started")
  if (!e || e.type !== "run_started") throw new Error("run has no run_started")
  return { graph: nodeWorkflowSchema.parse(e.graph) as NodeWorkflow, trigger: e.trigger }
}

/** Source steps of the active edges into a node, in edge file order. */
function activeInputs(
  graph: NodeWorkflow,
  steps: StepsState,
  runRoot: string,
  nodeId: string
): ExecInput[] {
  const kindOf = new Map(graph.nodes.map((n) => [n.id, n.kind]))
  const out: ExecInput[] = []
  for (const e of graph.edges) {
    if (e.to !== nodeId) continue
    const s = latestStep(steps, e.from)
    if (s?.status !== "done") continue
    if (e.branch !== undefined && e.branch !== s.branch) continue
    out.push({
      nodeId: e.from,
      kind: kindOf.get(e.from)!,
      dir: stepDir(runRoot, e.from, s.pass),
    })
  }
  return out
}

/**
 * One scheduling pass over a node run: acts on due steps (append
 * `step_started`, act, then settle) until nothing is due, then ends the
 * run. A `step_started` with no attempt and no end is acted on again,
 * which is safe for kinds with no process (DES-034, Crash recovery).
 */
export function tickNodes(opts: NodeRunOptions): StepsState {
  const { log, home, runId } = opts
  for (;;) {
    const events = log.listByRun(runId).map((s) => s.event)
    const { graph, trigger } = runStarted(events)
    const runRoot = runDir(workflowDir(home, graph.id), runId)
    const steps = foldSteps(events)
    if (steps.ended) return steps

    const act = (nodeId: string, pass: number) => {
      const node = graph.nodes.find((n) => n.id === nodeId)!
      const executor = executorFor(node.kind)
      if (!executor) throw new Error(`no executor for kind ${node.kind}`)
      const ctx: ExecContext = {
        graph,
        node,
        pass,
        runRoot,
        stepDir: stepDir(runRoot, nodeId, pass),
        inputs: activeInputs(graph, steps, runRoot, nodeId),
        frozenFile: (name) => {
          const p = join(frozenDir(runRoot, nodeId), name)
          return existsSync(p) ? readFileSync(p, "utf8") : undefined
        },
      }
      try {
        const result = executor.run(ctx)
        opts.crashAt?.("after_act", nodeId)
        log.append({
          type: "step_done",
          runId,
          at: now(),
          nodeId,
          pass,
          outputs: result.outputs,
          ...(result.branch ? { branch: result.branch } : {}),
          ...(result.answer ? { answer: result.answer } : {}),
        })
      } catch (error) {
        if (error instanceof CrashError) throw error
        log.append({
          type: "step_failed",
          runId,
          at: now(),
          nodeId,
          pass,
          reason: "exit",
        })
      }
    }

    let progressed = false

    // Crash recovery: started, no attempt, no end.
    for (const [nodeId, list] of Object.entries(steps.steps)) {
      for (const s of list) {
        const kind = graph.nodes.find((n) => n.id === nodeId)?.kind
        if (
          s.status === "running" &&
          s.attempts === 0 &&
          kind &&
          executorFor(kind)
        ) {
          act(nodeId, s.pass)
          progressed = true
        }
      }
    }
    if (progressed) continue

    const actions = nextActions(
      graph,
      { trigger: trigger ?? "" },
      steps
    )
    for (const a of actions) {
      if (a.type === "skip") {
        log.append({
          type: "step_skipped",
          runId,
          at: now(),
          nodeId: a.nodeId,
          pass: a.pass,
        })
        progressed = true
        continue
      }
      log.append({
        type: "step_started",
        runId,
        at: now(),
        nodeId: a.nodeId,
        pass: a.pass,
      })
      opts.crashAt?.("after_step_started", a.nodeId)
      act(a.nodeId, a.pass)
      progressed = true
      break // inputs for later actions are read from a fresh fold
    }
    if (progressed) continue

    const after = foldSteps(log.listByRun(runId).map((s) => s.event))
    if (Object.values(after.steps).flat().some((s) => isOpen(s.status))) {
      return after // a process step is still open
    }
    const failed = Object.values(after.steps)
      .flat()
      .some((s) => s.status === "failed")
    log.append({
      type: failed ? "run_failed" : "run_succeeded",
      runId,
      at: now(),
    })
    return foldSteps(log.listByRun(runId).map((s) => s.event))
  }
}

function isOpen(status: string): boolean {
  return status === "pending" || status === "running" || status === "waiting"
}

/** Thrown by a `crashAt` hook; the tick does not turn it into a failure. */
export class CrashError extends Error {}

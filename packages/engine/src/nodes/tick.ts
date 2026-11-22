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
  resolveAnswerValues,
  type EngineEvent,
  type NodeWorkflow,
} from "@workspace/shared"
import type { EventLog } from "../event-log.ts"
import { runDir, workflowDir } from "../paths.ts"
import { manualItemKey } from "../item-key.ts"
import { manualSource, type ManualItem } from "../source-manual.ts"
import { retryBackoffMs } from "../loops.ts"
import {
  isLaunchPlan,
  isPublishPlan,
  isWaitPlan,
  type ExecContext,
  type ExecInput,
} from "./define.ts"
import { foldSteps, latestStep, type StepsState } from "./fold-steps.ts"
import {
  launchAttempt,
  reattachAttempts,
  attemptRootOf,
  type ProcessHost,
} from "./process.ts"
import { publishTargetOf, startPublishStep } from "./publish.ts"
import { executorFor } from "./registry.ts"
import { frozenDir, stepDir } from "./step-paths.ts"
import { nextActions } from "./walk.ts"
import { cancelRequested, finishNodeCancel } from "./cancel.ts"

export type NodeRunOptions = {
  log: EventLog
  home: string
  runId: string
  /** Test hook: throw to simulate a crash at a point (DES-034). */
  crashAt?: (
    point:
      | "after_step_started"
      | "after_act"
      | "after_attempt_started"
      | "after_attempt_launched",
    nodeId: string
  ) => void
  /** Needed by agent and command steps; see `runNodes` (drive.ts). */
  process?: ProcessHost
}

export type StartNodeRunOptions = Omit<NodeRunOptions, "crashAt"> & {
  graph: NodeWorkflow
  /** Trigger to start from; default is the first trigger node. */
  trigger?: string
  /** Run input text, frozen as `input/text.md`. */
  inputText?: string
  /** Declared Trigger inputs and uploads, written like a task run (BL-104). */
  inputs?: ManualItem
  /** Wait for a free slot under `maxConcurrentRuns`: append only (DES-021). */
  queued?: boolean
  workItemId?: string
  /** Pins made before the start; their pull events follow `run_started` (BL-082). */
  pins?: { pulledEvents: EngineEvent[] }
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
  if (opts.inputs) {
    const { fields, inputsJson } = manualSource.materialize(opts.inputs, input)
    const full = {
      ...inputsJson,
      itemKey: manualItemKey(fields),
      itemKeyVersion: 1,
      ...(opts.workItemId !== undefined ? { workItemId: opts.workItemId } : {}),
    }
    writeFileSync(join(input, "inputs.json"), JSON.stringify(full, null, 2))
  }

  for (const node of graph.nodes) {
    const src = join(wfRoot, "nodes", node.id)
    if (existsSync(src)) {
      cpSync(src, frozenDir(runRoot, node.id), { recursive: true })
    }
  }

  const layout = join(wfRoot, "workflow.layout.json")
  if (existsSync(layout)) cpSync(layout, join(runRoot, "layout.json"))

  const trigger =
    opts.trigger ?? graph.nodes.find((n) => n.kind === "trigger")?.id
  log.append({
    type: "run_started",
    runId,
    at: now(),
    workflowId: graph.id,
    graph: graph as never,
    source: "manual",
    ...(trigger ? { trigger } : {}),
    ...(opts.queued ? { queued: true } : {}),
    ...(opts.workItemId !== undefined ? { workItemId: opts.workItemId } : {}),
  })
  for (const pulled of opts.pins?.pulledEvents ?? []) log.append(pulled)
  if (opts.queued) return foldSteps(log.listByRun(runId).map((x) => x.event))
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
    if (cancelRequested(events)) {
      finishNodeCancel(log, runId)
      return foldSteps(log.listByRun(runId).map((s) => s.event))
    }

    const build = (nodeId: string, pass: number) => {
      const node = graph.nodes.find((n) => n.id === nodeId)!
      const executor = executorFor(node.kind)
      if (!executor) throw new Error(`no executor for kind ${node.kind}`)
      const ctx: ExecContext = {
        graph,
        node,
        pass,
        runRoot,
        stepDir: stepDir(runRoot, nodeId, pass),
        workflowRoot: workflowDir(home, graph.id),
        answers: resolveAnswerValues(
          graph.nodes,
          graph.edges,
          nodeId,
          (id) => {
            const s = latestStep(steps, id)
            return s?.status === "done" ? s.answer : undefined
          }
        ),
        inputs: activeInputs(graph, steps, runRoot, nodeId),
        frozenFile: (name) => {
          const p = join(frozenDir(runRoot, nodeId), name)
          return existsSync(p) ? readFileSync(p, "utf8") : undefined
        },
        frozenPath: (name) => join(frozenDir(runRoot, nodeId), name),
      }
      return { ctx, executor }
    }

    const settle = (
      nodeId: string,
      pass: number,
      result: { outputs: string[]; branch?: string; answer?: Record<string, unknown> }
    ) => {
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
    }
    const fail = (
      nodeId: string,
      pass: number,
      reason: "exit" | "timeout" | "unclear" | "answer" | "loop_limit"
    ) => {
      log.append({
        type: "step_failed",
        runId,
        at: now(),
        nodeId,
        pass,
        reason,
      })
    }

    /** Runs a due step: settles at once, or starts an attempt. False when held back by a limit. */
    const run = (nodeId: string, pass: number): boolean => {
      const { ctx, executor } = build(nodeId, pass)
      try {
        const result = executor.run(ctx)
        if (isLaunchPlan(result)) {
          return launchAttempt({ ...opts, runId }, ctx, result.launch, steps)
        }
        if (isPublishPlan(result)) {
          // Runs in the background; true only when a job started (BL-084).
          return startPublishStep({ ...opts, runId }, ctx, false)
        }
        if (isWaitPlan(result)) {
          // No slot, no process: the step waits for a person (BL-080).
          log.append({
            type: "approval_requested",
            runId,
            at: now(),
            taskId: nodeId,
            nodeId,
            pass,
            question: result.wait.question,
          })
          return true
        }
        settle(nodeId, pass, result)
      } catch (error) {
        if (error instanceof CrashError) throw error
        fail(nodeId, pass, "exit")
      }
      return true
    }

    /** A process step whose attempt closed: done, retry or failed. */
    const settleAttempt = (nodeId: string, pass: number): boolean => {
      const step = steps.steps[nodeId]?.find((x) => x.pass === pass)
      const c = step?.current
      if (!step || !c) return false
      const node = graph.nodes.find((n) => n.id === nodeId)!
      if (!c.interrupted && c.exitCode === 0) {
        const { ctx, executor } = build(nodeId, pass)
        try {
          const result = executor.finish!(
            ctx,
            attemptRootOf(ctx.stepDir, c.attempt)
          )
          if (result.fix) return run(nodeId, pass)
          if (result.failed) fail(nodeId, pass, result.failed)
          else settle(nodeId, pass, result)
        } catch (error) {
          if (error instanceof CrashError) throw error
          fail(nodeId, pass, "exit")
        }
        return true
      }
      const max = (node as { retry?: { max: number } }).retry?.max
      if (max !== undefined && step.attempts < max) {
        const wait = retryBackoffMs() * 2 ** (step.attempts - 1)
        const due = Date.parse(c.endedAt ?? now()) + wait
        if (Date.now() < due) {
          opts.process?.later(due - Date.now())
          return false
        }
        return run(nodeId, pass)
      }
      fail(nodeId, pass, c.reason === "timeout" ? "timeout" : "exit")
      return true
    }

    let progressed = false

    // An approved Approval step settles by forwarding its input.
    for (const [nodeId, list] of Object.entries(steps.steps)) {
      for (const s of list) {
        if (s.status !== "running" || s.decision !== "approved") continue
        const { ctx, executor } = build(nodeId, s.pass)
        if (publishTargetOf(graph, nodeId)) {
          // An approved publish goes on in the background, past its gate.
          try {
            startPublishStep({ ...opts, runId }, ctx, true)
          } catch (error) {
            if (error instanceof CrashError) throw error
            fail(nodeId, s.pass, "exit")
            progressed = true
            break
          }
          continue
        }
        try {
          settle(nodeId, s.pass, executor.approved!(ctx))
        } catch (error) {
          if (error instanceof CrashError) throw error
          fail(nodeId, s.pass, "exit")
        }
        progressed = true
        break
      }
      if (progressed) break
    }
    if (progressed) continue

    // Re-attach to attempts left open by a restart (DES-034).
    if (opts.process) {
      const before = events.length
      reattachAttempts(
        { ...opts, runId },
        graph,
        steps,
        (nodeId, pass) => stepDir(runRoot, nodeId, pass)
      )
      if (log.listByRun(runId).length !== before) continue
    }

    // Crash recovery: started, no attempt, no end. A step that waits on
    // a limit stays in this state and does not count as progress.
    for (const [nodeId, list] of Object.entries(steps.steps)) {
      for (const s of list) {
        const kind = graph.nodes.find((n) => n.id === nodeId)?.kind
        if (
          s.status === "running" &&
          s.decision !== "approved" &&
          !s.current &&
          kind &&
          executorFor(kind)
        ) {
          if (run(nodeId, s.pass)) progressed = true
          if (progressed) break
        }
      }
      if (progressed) break
    }
    if (progressed) continue

    // A closed attempt settles its step, or retries it.
    for (const [nodeId, list] of Object.entries(steps.steps)) {
      for (const s of list) {
        if (s.status === "running" && s.current && !s.current.open) {
          if (settleAttempt(nodeId, s.pass)) progressed = true
          if (progressed) break
        }
      }
      if (progressed) break
    }
    if (progressed) continue

    const actions = nextActions(
      graph,
      { trigger: trigger ?? "", loopPasses: graph.limits?.loopPasses },
      steps
    )
    for (const a of actions) {
      if (a.type === "fail") {
        log.append({
          type: "step_started",
          runId,
          at: now(),
          nodeId: a.nodeId,
          pass: a.pass,
        })
        fail(a.nodeId, a.pass, a.reason)
        progressed = true
        continue
      }
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
      run(a.nodeId, a.pass)
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

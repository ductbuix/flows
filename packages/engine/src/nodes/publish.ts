import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  type ChangeSet,
  type EngineEvent,
  type NodeWorkflow,
  type Workflow,
} from "@workspace/shared"
import { readConnection } from "../connections.ts"
import type { EventLog } from "../event-log.ts"
import {
  appendPublishFinished,
  callPublish,
  needsPersonGate,
} from "../publish-apply.ts"
import { hasOpenPublish, readStoredChangeSet } from "../publish.ts"
import { runPublishAgentReview } from "../publish-review.ts"
import { diffWorkCopy } from "../work-copy.ts"
import { cancelRequested } from "./cancel.ts"
import type { ExecContext } from "./define.ts"
import { foldSteps } from "./fold-steps.ts"
import type { ProcessHost } from "./process.ts"
import { taskGraphOfNodes } from "./run-state.ts"
import { frozenDir, relOut } from "./step-paths.ts"

const now = () => new Date().toISOString()

export type PublishRun = {
  log: EventLog
  home: string
  runId: string
  process?: ProcessHost
}

/** The connection of a publish Output node, if the node is one. */
export function publishTargetOf(
  graph: NodeWorkflow,
  nodeId: string
): string | undefined {
  const node = graph.nodes.find((n) => n.id === nodeId)
  return node?.kind === "output" && node.target === "publish"
    ? node.connection
    : undefined
}

/** Fails a start when a publish Output names an unknown or read-only connection. */
export function assertNodePublishValid(home: string, graph: NodeWorkflow): void {
  for (const n of graph.nodes) {
    if (n.kind !== "output" || n.target !== "publish") continue
    const conn = n.connection ? readConnection(home, n.connection) : null
    if (!conn) {
      throw new Error(
        `publish node ${n.id} references unknown connection ${n.connection}`
      )
    }
    if (conn.policy === "read-only") {
      throw new Error(
        `publish node ${n.id} cannot use read-only connection ${n.connection}`
      )
    }
  }
}

/** Goals file for the agent review: the steps upstream of the Output. */
function nodeGoalsMarkdown(ctx: ExecContext): string {
  const up = new Set<string>()
  const todo = [ctx.node.id]
  while (todo.length > 0) {
    const at = todo.pop()!
    for (const e of ctx.graph.edges) {
      if (e.to === at && !up.has(e.from)) {
        up.add(e.from)
        todo.push(e.from)
      }
    }
  }
  const lines = ["# Propose task goals", ""]
  for (const n of ctx.graph.nodes) {
    if (!up.has(n.id)) continue
    if (n.kind !== "agent" && n.kind !== "command" && n.kind !== "llm") continue
    lines.push(`## ${n.id}`)
    if (n.name) lines.push(`name: ${n.name}`)
    lines.push(`kind: ${n.kind}`)
    if (n.kind === "command") {
      lines.push("run:", "```", n.run, "```")
    } else {
      const prompt = join(frozenDir(ctx.runRoot, n.id), "prompt.md")
      if (existsSync(prompt)) {
        lines.push("prompt:", "```", readFileSync(prompt, "utf8").trim(), "```")
      }
    }
    lines.push("")
  }
  if (lines.length === 2) lines.push("(no propose steps)", "")
  return lines.join("\n")
}

/**
 * Starts the publish flow of an Output step in the background (BL-084).
 * One job per step and pass; false when one is already in flight. The job
 * wakes the tick when it ends. `approved` skips the policy gate, as after
 * a person approved the change set.
 */
export function startPublishStep(
  run: PublishRun,
  ctx: ExecContext,
  approved: boolean
): boolean {
  const host = run.process
  if (!host) throw new Error("publish steps need a process host")
  const key = `publish:${ctx.node.id}:${ctx.pass}`
  if (host.watching.has(key)) return false
  host.watching.add(key)
  void publishFlow(run, ctx, approved)
    .catch(() => settle(run, ctx, { failed: "exit" }))
    .finally(() => {
      host.watching.delete(key)
      host.wake()
    })
  return true
}

/** The step settles only if it is still open and the run was not cancelled. */
function settle(
  run: PublishRun,
  ctx: ExecContext,
  end: { outputs: string[] } | { failed: "exit" | "conflict" | "rejected" }
): void {
  const events = run.log.listByRun(run.runId).map((s) => s.event)
  if (cancelRequested(events)) return
  const step = foldSteps(events).steps[ctx.node.id]?.find(
    (s) => s.pass === ctx.pass
  )
  if (step?.status !== "running") return
  const base = {
    runId: run.runId,
    at: now(),
    nodeId: ctx.node.id,
    pass: ctx.pass,
  }
  if ("failed" in end) {
    run.log.append({ type: "step_failed", ...base, reason: end.failed })
  } else {
    run.log.append({ type: "step_done", ...base, outputs: end.outputs })
  }
}

async function publishFlow(
  run: PublishRun,
  ctx: ExecContext,
  approved: boolean
): Promise<void> {
  const connection = publishTargetOf(ctx.graph, ctx.node.id)
  if (!connection) throw new Error("not a publish output")
  const nodeId = ctx.node.id
  const target = { id: nodeId, connection }
  const host = {
    home: run.home,
    runRoot: ctx.runRoot,
    runId: run.runId,
    append: (e: EngineEvent) => run.log.append(e),
  }
  const resultOutputs = () =>
    existsSync(join(ctx.stepDir, "result.json"))
      ? [relOut("nodes", nodeId, `pass-${ctx.pass}`, "result.json")]
      : []
  const events = run.log.listByRun(run.runId).map((s) => s.event)

  const conn = readConnection(run.home, connection)
  // A policy changed to read-only since the start still blocks the send.
  if (!conn || conn.policy === "read-only") {
    settle(run, ctx, { failed: "exit" })
    return
  }

  let changeSet: ChangeSet
  if (hasOpenPublish(events, nodeId)) {
    // Crash between publish_started and publish_finished: ask the connector
    // again with the stored change set (its receipt makes this safe).
    const stored = readStoredChangeSet(ctx.runRoot, nodeId)
    if (!stored) {
      run.log.append({
        type: "publish_finished",
        runId: run.runId,
        taskId: nodeId,
        connection,
        status: "rejected",
        message: "missing_changeset_on_resume",
        at: now(),
      })
      settle(run, ctx, { failed: "rejected" })
      return
    }
    changeSet = stored
  } else {
    changeSet = (
      await diffWorkCopy({
        home: run.home,
        runRoot: ctx.runRoot,
        connectionId: connection,
        publishTaskId: nodeId,
        runId: run.runId,
      })
    ).changeSet
    if (changeSet.ops.length === 0) {
      settle(run, ctx, { outputs: resultOutputs() })
      return
    }
    if (!approved && !(await gate(run, ctx, changeSet, conn.policy))) return
    run.log.append({
      type: "publish_started",
      runId: run.runId,
      taskId: nodeId,
      connection,
      at: now(),
    })
  }

  try {
    const outcome = await callPublish(host, target, changeSet)
    appendPublishFinished(host, target, outcome, ctx.stepDir)
    if (outcome.status === "applied") {
      settle(run, ctx, { outputs: resultOutputs() })
    } else {
      settle(run, ctx, { failed: outcome.status })
    }
  } catch (err) {
    run.log.append({
      type: "publish_finished",
      runId: run.runId,
      taskId: nodeId,
      connection,
      status: "rejected",
      message: err instanceof Error ? err.message : "publish_failed",
      at: now(),
    })
    settle(run, ctx, { failed: "rejected" })
  }
}

/** The policy gate (DES-026): true when the send may go on without a person. */
async function gate(
  run: PublishRun,
  ctx: ExecContext,
  changeSet: ChangeSet,
  policy: string
): Promise<boolean> {
  const nodeId = ctx.node.id
  const connection = changeSet.connection
  if (policy === "trust-agent-review") {
    const workflow = {
      ...taskGraphOfNodes(ctx.graph),
      ...(ctx.graph.agent ? { agent: ctx.graph.agent } : {}),
      ...(ctx.graph.timeout ? { timeout: ctx.graph.timeout } : {}),
    } as Workflow
    const review = await runPublishAgentReview({
      home: run.home,
      runRoot: ctx.runRoot,
      workflowRoot: ctx.workflowRoot,
      workflow,
      task: {
        id: nodeId,
        connection,
        timeout: (ctx.node as { timeout?: number }).timeout,
      },
      changeSet,
      goals: nodeGoalsMarkdown(ctx),
    })
    run.log.append({
      type: "agent_review_finished",
      runId: run.runId,
      taskId: nodeId,
      connection,
      verdict: review.verdict,
      reason: review.reason,
      at: now(),
    })
    if (review.verdict === "approve") return true
  } else if (!needsPersonGate(policy, changeSet)) {
    return true
  }
  const n = changeSet.ops.length
  run.log.append({
    type: "approval_requested",
    runId: run.runId,
    at: now(),
    taskId: nodeId,
    nodeId,
    pass: ctx.pass,
    question: `Publish ${n} change${n === 1 ? "" : "s"} to ${connection}?`,
  })
  return false
}

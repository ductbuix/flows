import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { ChangeSet, EngineEvent, PublishTask } from "@workspace/shared"
import { readConnection } from "./connections.ts"
import { getConnector } from "./connectors/registry.ts"
import type { ConnectorPublishResult } from "./connectors/types.ts"
import { prepareAttemptDirs } from "./dirs.ts"
import type { RunState } from "./fold.ts"
import { attemptDir } from "./paths.ts"
import { runPublishAgentReview } from "./publish-review.ts"
import { advanceWorkCopyBase } from "./work-copy.ts"

export type PublishHost = {
  runId: string
  runRoot: string
  workflowRoot: string
  home: string
  state: () => RunState
  append: (event: EngineEvent) => void
  requestTick: () => void
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function needsPersonGate(policy: string, changeSet: ChangeSet): boolean {
  if (policy === "approve-each-publish") return true
  // Destructive ops always wait; trust-agent-review still records a
  // review event before the gate (DES-026 / BL-052).
  return changeSet.ops.some((o) => o.destructive)
}

/** True when the publish may proceed (person or agent approved). */
export async function gatePublish(
  host: PublishHost,
  task: PublishTask,
  changeSet: ChangeSet,
  policy: string
): Promise<boolean> {
  const live = host.state().tasks[task.id]
  if (!live || live.approved) return true

  if (policy === "trust-agent-review") {
    const review = await runPublishAgentReview({
      home: host.home,
      runRoot: host.runRoot,
      workflowRoot: host.workflowRoot,
      workflow: host.state().graph,
      task,
      changeSet,
    })
    host.append({
      type: "agent_review_finished",
      runId: host.runId,
      taskId: task.id,
      connection: task.connection,
      verdict: review.verdict,
      reason: review.reason,
      at: nowIso(),
    })
    if (review.verdict === "approve") return true
    host.append({
      type: "approval_requested",
      runId: host.runId,
      taskId: task.id,
      at: nowIso(),
    })
    return false
  }

  if (needsPersonGate(policy, changeSet)) {
    host.append({
      type: "approval_requested",
      runId: host.runId,
      taskId: task.id,
      at: nowIso(),
    })
    return false
  }
  return true
}

export async function callPublish(
  host: PublishHost,
  task: PublishTask,
  changeSet: ChangeSet
): Promise<ConnectorPublishResult> {
  const conn = readConnection(host.home, task.connection)
  if (!conn) throw new Error(`unknown connection ${task.connection}`)
  const connector = getConnector(conn.connector)
  if (!connector) throw new Error(`unknown connector ${conn.connector}`)
  return connector.publish(conn, changeSet, host.home, {
    runRoot: host.runRoot,
  })
}

export function appendPublishFinished(
  host: PublishHost,
  task: PublishTask,
  outcome: ConnectorPublishResult
): void {
  if (outcome.status === "applied") {
    prepareAttemptDirs(host.runRoot, task.id, 1)
    const out = join(attemptDir(host.runRoot, task.id, 1), "out")
    mkdirSync(out, { recursive: true })
    writeFileSync(
      join(out, "result.json"),
      JSON.stringify(outcome.result, null, 2)
    )
    advanceWorkCopyBase(host.runRoot, task.connection)
    host.append({
      type: "publish_finished",
      runId: host.runId,
      taskId: task.id,
      connection: task.connection,
      status: "applied",
      result: outcome.result,
      undoNote: outcome.undoNote,
      impact: "cloud",
      at: nowIso(),
    })
    return
  }
  host.append({
    type: "publish_finished",
    runId: host.runId,
    taskId: task.id,
    connection: task.connection,
    status: outcome.status,
    message: outcome.message,
    at: nowIso(),
  })
}

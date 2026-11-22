import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { ChangeSet, EngineEvent } from "@workspace/shared"
import { readConnection } from "./connections.ts"
import { getConnector } from "./connectors/registry.ts"
import type { ConnectorPublishResult } from "./connectors/types.ts"
import { advanceWorkCopyBase } from "./work-copy.ts"

/** What a publish call and its events need from the run. */
export type PublishHost = {
  runId: string
  runRoot: string
  home: string
  append: (event: EngineEvent) => void
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

/** The part of a task a publish call needs; a publish Output node has the same. */
export type PublishTarget = { id: string; connection: string }

export async function callPublish(
  host: Pick<PublishHost, "home" | "runRoot">,
  task: PublishTarget,
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

/** `resultDir` is where `result.json` goes: the Output step folder (BL-084). */
export function appendPublishFinished(
  host: Pick<PublishHost, "runId" | "runRoot" | "append">,
  task: PublishTarget,
  outcome: ConnectorPublishResult,
  resultDir: string
): void {
  if (outcome.status === "applied") {
    mkdirSync(resultDir, { recursive: true })
    writeFileSync(
      join(resultDir, "result.json"),
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

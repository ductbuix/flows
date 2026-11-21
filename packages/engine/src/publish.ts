import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  isPublishTask,
  type ChangeSet,
  type EngineEvent,
  type PublishTask,
  type Workflow,
} from "@workspace/shared"
import { readConnection } from "./connections.ts"
import {
  appendPublishFinished,
  callPublish,
  needsPersonGate,
  nowIso,
  type PublishHost,
} from "./publish-apply.ts"
import { diffWorkCopy, publishChangesDir } from "./work-copy.ts"

export type { PublishHost } from "./publish-apply.ts"

/** Fail start when a publish task targets a read-only connection. */
export function assertPublishTasksValid(
  home: string,
  workflow: Workflow
): void {
  for (const task of workflow.tasks) {
    if (!isPublishTask(task)) continue
    const conn = readConnection(home, task.connection)
    if (!conn) {
      throw new Error(
        `publish task ${task.id} references unknown connection ${task.connection}`
      )
    }
    if (conn.policy === "read-only") {
      throw new Error(
        `publish task ${task.id} cannot use read-only connection ${task.connection}`
      )
    }
  }
}

function readStoredChangeSet(
  runRoot: string,
  taskId: string
): ChangeSet | null {
  const path = join(publishChangesDir(runRoot, taskId), "changeset.json")
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ChangeSet
  } catch {
    return null
  }
}

/** True when publish_started has no matching publish_finished. */
export function hasOpenPublish(events: EngineEvent[], taskId: string): boolean {
  let open = false
  for (const e of events) {
    if (e.type === "publish_started" && e.taskId === taskId) open = true
    if (e.type === "publish_finished" && e.taskId === taskId) open = false
  }
  return open
}

/**
 * Run or gate a ready / approved publish task (DES-026 / BL-049).
 * Empty change sets succeed with nothing sent.
 */
export async function runPublishTask(
  host: PublishHost,
  task: PublishTask
): Promise<void> {
  const live = host.state().tasks[task.id]
  if (!live) return
  if (live.status !== "pending" && live.status !== "awaiting_approval") return

  const conn = readConnection(host.home, task.connection)
  if (!conn) {
    host.append({
      type: "task_failed",
      runId: host.runId,
      taskId: task.id,
      at: nowIso(),
    })
    return
  }

  const { changeSet } = await diffWorkCopy({
    home: host.home,
    runRoot: host.runRoot,
    connectionId: task.connection,
    publishTaskId: task.id,
    runId: host.runId,
  })

  if (changeSet.ops.length === 0) {
    host.append({
      type: "task_succeeded",
      runId: host.runId,
      taskId: task.id,
      at: nowIso(),
    })
    host.requestTick()
    return
  }

  if (needsPersonGate(conn.policy, changeSet) && !live.approved) {
    host.append({
      type: "approval_requested",
      runId: host.runId,
      taskId: task.id,
      at: nowIso(),
    })
    return
  }

  host.append({
    type: "publish_started",
    runId: host.runId,
    taskId: task.id,
    connection: task.connection,
    at: nowIso(),
  })

  try {
    const outcome = await callPublish(host, task, changeSet)
    appendPublishFinished(host, task, outcome)
  } catch (err) {
    host.append({
      type: "publish_finished",
      runId: host.runId,
      taskId: task.id,
      connection: task.connection,
      status: "rejected",
      message: err instanceof Error ? err.message : "publish_failed",
      at: nowIso(),
    })
  }
  host.requestTick()
}

/**
 * Resume a publish that started before a crash: ask the connector
 * (idempotent receipt) before treating it as done (DES-026 / BL-049).
 */
export async function resumeInFlightPublishes(
  host: PublishHost,
  events: EngineEvent[]
): Promise<void> {
  const state = host.state()
  if (state.status !== "running") return

  for (const spec of state.graph.tasks) {
    if (!isPublishTask(spec)) continue
    const live = state.tasks[spec.id]
    if (!live || live.status !== "running") continue
    if (!hasOpenPublish(events, spec.id)) continue

    const changeSet = readStoredChangeSet(host.runRoot, spec.id)
    if (!changeSet) {
      host.append({
        type: "publish_finished",
        runId: host.runId,
        taskId: spec.id,
        connection: spec.connection,
        status: "rejected",
        message: "missing_changeset_on_resume",
        at: nowIso(),
      })
      host.requestTick()
      continue
    }

    try {
      const outcome = await callPublish(host, spec, changeSet)
      appendPublishFinished(host, spec, outcome)
    } catch (err) {
      host.append({
        type: "publish_finished",
        runId: host.runId,
        taskId: spec.id,
        connection: spec.connection,
        status: "rejected",
        message: err instanceof Error ? err.message : "publish_failed",
        at: nowIso(),
      })
    }
    host.requestTick()
  }
}

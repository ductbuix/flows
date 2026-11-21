import { isMap, parseDocument } from "yaml"
import type { Task } from "./workflow.ts"
import { upsertTask } from "./workflow-yaml-edit.ts"
import { taskIndex } from "./workflow-yaml.ts"

type SharedTaskFields = Pick<
  Task,
  | "id"
  | "name"
  | "needs"
  | "approval"
  | "when"
  | "retry"
  | "repeat"
  | "continueOnError"
  | "spawnDepth"
  | "spawnedBy"
  | "promptDir"
>

type TaskSharedInput = {
  id: string
  name?: Task["name"]
  needs?: Task["needs"]
  approval?: Task["approval"]
  when?: Task["when"]
  retry?: Task["retry"]
  repeat?: Task["repeat"]
  continueOnError?: Task["continueOnError"]
  spawnDepth?: Task["spawnDepth"]
  spawnedBy?: Task["spawnedBy"]
  promptDir?: Task["promptDir"]
}

function sharedTaskFields(task: TaskSharedInput): SharedTaskFields {
  return {
    id: task.id,
    needs: task.needs ?? [],
    ...(task.name !== undefined ? { name: task.name } : {}),
    ...(task.approval !== undefined ? { approval: task.approval } : {}),
    ...(task.when !== undefined ? { when: task.when } : {}),
    ...(task.retry !== undefined ? { retry: task.retry } : {}),
    ...(task.repeat !== undefined ? { repeat: task.repeat } : {}),
    ...(task.continueOnError !== undefined
      ? { continueOnError: task.continueOnError }
      : {}),
    ...(task.spawnDepth !== undefined ? { spawnDepth: task.spawnDepth } : {}),
    ...(task.spawnedBy !== undefined ? { spawnedBy: task.spawnedBy } : {}),
    ...(task.promptDir !== undefined ? { promptDir: task.promptDir } : {}),
  }
}

export type TaskKind = "command" | "agent" | "publish"

type PublishKindInput = TaskSharedInput & { connection?: string }

/** Build a valid task for `kind`, keeping shared fields (DES-018 / DES-020). */
export function taskWithKind(task: PublishKindInput, kind: TaskKind): Task {
  const shared = sharedTaskFields(task)
  if (kind === "agent") {
    return {
      ...shared,
      kind: "agent",
      cli: "claude",
    }
  }
  if (kind === "publish") {
    return {
      id: shared.id,
      needs: shared.needs,
      ...(shared.name !== undefined ? { name: shared.name } : {}),
      ...(shared.when !== undefined ? { when: shared.when } : {}),
      ...(shared.continueOnError !== undefined
        ? { continueOnError: shared.continueOnError }
        : {}),
      ...(shared.spawnDepth !== undefined
        ? { spawnDepth: shared.spawnDepth }
        : {}),
      ...(shared.spawnedBy !== undefined
        ? { spawnedBy: shared.spawnedBy }
        : {}),
      ...(shared.promptDir !== undefined
        ? { promptDir: shared.promptDir }
        : {}),
      kind: "publish",
      connection: task.connection ?? "connection",
    }
  }
  return {
    ...shared,
    kind: "command",
    run: "echo ok",
  }
}

/**
 * Replace a task with a valid shape for the new kind (DES-018 / BL-015).
 * Other tasks keep comments and key order via upsert in place.
 */
export function switchTaskKind(
  text: string,
  taskId: string,
  kind: TaskKind,
  connection?: string
): string {
  const doc = parseDocument(text, { keepSourceTokens: true })
  const idx = taskIndex(doc, taskId)
  if (idx < 0) return text
  const raw = doc.getIn(["tasks", idx])
  if (!isMap(raw)) return text
  const current = raw.toJSON() as Record<string, unknown> | null
  if (!current || typeof current !== "object") return text
  return upsertTask(
    text,
    taskWithKind(
      { ...current, id: taskId, connection } as PublishKindInput,
      kind
    )
  )
}

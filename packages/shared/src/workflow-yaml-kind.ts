import { isMap, parseDocument } from "yaml"
import type { Task } from "./workflow.ts"
import { upsertTask } from "./workflow-yaml-edit.ts"
import { taskIndex } from "./workflow-yaml.ts"

type SharedTaskFields = Pick<
  Task,
  | "id"
  | "needs"
  | "approval"
  | "when"
  | "retry"
  | "repeat"
  | "continueOnError"
  | "spawnDepth"
  | "spawnedBy"
>

type TaskSharedInput = {
  id: string
  needs?: Task["needs"]
  approval?: Task["approval"]
  when?: Task["when"]
  retry?: Task["retry"]
  repeat?: Task["repeat"]
  continueOnError?: Task["continueOnError"]
  spawnDepth?: Task["spawnDepth"]
  spawnedBy?: Task["spawnedBy"]
}

function sharedTaskFields(task: TaskSharedInput): SharedTaskFields {
  return {
    id: task.id,
    needs: task.needs ?? [],
    ...(task.approval !== undefined ? { approval: task.approval } : {}),
    ...(task.when !== undefined ? { when: task.when } : {}),
    ...(task.retry !== undefined ? { retry: task.retry } : {}),
    ...(task.repeat !== undefined ? { repeat: task.repeat } : {}),
    ...(task.continueOnError !== undefined
      ? { continueOnError: task.continueOnError }
      : {}),
    ...(task.spawnDepth !== undefined ? { spawnDepth: task.spawnDepth } : {}),
    ...(task.spawnedBy !== undefined ? { spawnedBy: task.spawnedBy } : {}),
  }
}

/** Build a valid task for `kind`, keeping shared fields (DES-018). */
export function taskWithKind(
  task: TaskSharedInput,
  kind: "command" | "agent"
): Task {
  const shared = sharedTaskFields(task)
  if (kind === "agent") {
    return {
      ...shared,
      kind: "agent",
      cli: "claude",
      instructions: `tasks/${task.id}.md`,
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
  kind: "command" | "agent"
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
    taskWithKind({ ...current, id: taskId } as TaskSharedInput, kind)
  )
}

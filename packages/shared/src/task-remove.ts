import { upstreamEnvName } from "./task-ids.ts"
import { needTaskId, type Task, type Workflow } from "./workflow.ts"

export type TaskLabel = { id: string; label: string }

/** Display name falling back to id (DES-022). */
export function taskLabel(task: Pick<Task, "id" | "name">): string {
  return task.name?.trim() ? task.name : task.id
}

/** Tasks whose `needs` point at `removedId`, labeled for the confirm. */
export function dependentsOf(
  workflow: Workflow,
  removedId: string
): TaskLabel[] {
  return workflow.tasks
    .filter((t) => (t.needs ?? []).some((n) => needTaskId(n) === removedId))
    .map((t) => ({ id: t.id, label: taskLabel(t) }))
}

export type MentionHit = {
  taskId: string
  label: string
  where: "run" | "prompt"
}

/**
 * Warn-only: other tasks whose `run` or prompt text mentions the
 * removed id or its `UPSTREAM_*` env name (DES-022).
 */
export function collectMentionHits(
  workflow: Workflow,
  removedId: string,
  prompts: ReadonlyMap<string, string>
): MentionHit[] {
  const env = upstreamEnvName(removedId)
  const hits: MentionHit[] = []
  for (const task of workflow.tasks) {
    if (task.id === removedId) continue
    const label = taskLabel(task)
    if (task.kind === "command" && textMentions(task.run, removedId, env)) {
      hits.push({ taskId: task.id, label, where: "run" })
    }
    const prompt = prompts.get(task.id)
    if (prompt !== undefined && textMentions(prompt, removedId, env)) {
      hits.push({ taskId: task.id, label, where: "prompt" })
    }
  }
  return hits
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Exact env match, or task id as its own token (not inside `echo`). */
function textMentions(text: string, taskId: string, env: string): boolean {
  if (text.includes(env)) return true
  const re = new RegExp(
    `(^|[^A-Za-z0-9_-])${escapeRegExp(taskId)}([^A-Za-z0-9_-]|$)`
  )
  return re.test(text)
}

/** Task ids present in `before` but not in `after`. */
export function removedTaskIds(before: Workflow, after: Workflow): string[] {
  const next = new Set(after.tasks.map((t) => t.id))
  return before.tasks.map((t) => t.id).filter((id) => !next.has(id))
}

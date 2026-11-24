import type { TodoEntry } from "@workspace/core"
import { z } from "zod"

/** Cursor ACP extension method (DES-041 / BL-149). */
export const CURSOR_UPDATE_TODOS_METHOD = "cursor/update_todos"

const todoStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
])

const todoSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  status: todoStatusSchema,
})

const paramsSchema = z.object({
  toolCallId: z.string().min(1),
  todos: z.array(todoSchema),
  merge: z.boolean(),
})

export type UpdateTodosParams = {
  toolCallId: string
  todos: TodoEntry[]
  merge: boolean
}

/** Parse `cursor/update_todos` params; null when malformed. */
export function parseUpdateTodosParams(
  params: unknown
): UpdateTodosParams | null {
  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) return null
  return {
    toolCallId: parsed.data.toolCallId,
    todos: parsed.data.todos.map((t) => ({
      id: t.id,
      content: t.content,
      status: t.status,
    })),
    merge: parsed.data.merge,
  }
}

/**
 * Apply an update: `merge: false` replaces; `merge: true` upserts by id
 * (existing order kept, new ids appended).
 */
export function mergeTodos(
  existing: readonly TodoEntry[],
  incoming: readonly TodoEntry[],
  merge: boolean
): TodoEntry[] {
  if (!merge) return incoming.map((t) => ({ ...t }))
  const byId = new Map(existing.map((t) => [t.id, t]))
  for (const t of incoming) byId.set(t.id, { ...t })
  const out: TodoEntry[] = []
  const seen = new Set<string>()
  for (const t of existing) {
    const next = byId.get(t.id)
    if (!next) continue
    out.push(next)
    seen.add(t.id)
  }
  for (const t of incoming) {
    if (seen.has(t.id)) continue
    out.push({ ...t })
  }
  return out
}

export function acceptedUpdateTodosResult(todos: readonly TodoEntry[]) {
  return {
    outcome: {
      outcome: "accepted" as const,
      todos: todos.map((t) => ({ ...t })),
    },
  }
}

export function rejectedUpdateTodosResult(reason?: string) {
  return {
    outcome: {
      outcome: "rejected" as const,
      ...(reason !== undefined ? { reason } : {}),
    },
  }
}

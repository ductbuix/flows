import { z } from "zod"

/** Cursor ACP extension method (DES-041 / BL-149). */
export const CURSOR_TASK_METHOD = "cursor/task"

const subagentTypeSchema = z.union([
  z.string().min(1),
  z.object({ custom: z.string().min(1) }),
])

const paramsSchema = z.object({
  toolCallId: z.string().min(1),
  description: z.string().min(1),
  prompt: z.string().optional(),
  subagentType: subagentTypeSchema,
  model: z.string().optional(),
  agentId: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
})

export type TaskParams = {
  toolCallId: string
  description: string
  prompt?: string
  /** Normalized string form (`custom` objects become the custom name). */
  subagentType: string
  model?: string
  agentId?: string
  durationMs?: number
}

function normalizeSubagentType(value: string | { custom: string }): string {
  return typeof value === "string" ? value : value.custom
}

/** Parse `cursor/task` params; null when malformed. */
export function parseTaskParams(params: unknown): TaskParams | null {
  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) return null
  const d = parsed.data
  return {
    toolCallId: d.toolCallId,
    description: d.description,
    subagentType: normalizeSubagentType(d.subagentType),
    ...(d.prompt !== undefined ? { prompt: d.prompt } : {}),
    ...(d.model !== undefined ? { model: d.model } : {}),
    ...(d.agentId !== undefined ? { agentId: d.agentId } : {}),
    ...(d.durationMs !== undefined ? { durationMs: d.durationMs } : {}),
  }
}

export function completedTaskResult(params: {
  agentId?: string
  durationMs?: number
}) {
  return {
    outcome: {
      outcome: "completed" as const,
      ...(params.agentId !== undefined ? { agentId: params.agentId } : {}),
      ...(params.durationMs !== undefined
        ? { durationMs: params.durationMs }
        : {}),
    },
  }
}

export function rejectedTaskResult(reason?: string) {
  return {
    outcome: {
      outcome: "rejected" as const,
      ...(reason !== undefined ? { reason } : {}),
    },
  }
}

import { z } from "zod"
import { logChunkSchema } from "../api.ts"
import { cursorPlanTodoSchema } from "../cursor-plan.ts"

const seqRun = {
  seq: z.number().int().nonnegative(),
  runId: z.string().min(1),
}

const stepId = z.string().min(1)

const planEntrySchema = z.object({
  content: z.string(),
  status: z.string().optional(),
  priority: z.string().optional(),
})

const moneySchema = z.object({
  amount: z.number(),
  currency: z.string(),
})

/** Agent / log stream kinds on `run/update` (DES-040, BL-141, BL-149). */
export const runUpdateAgentKinds = [
  z.object({
    ...seqRun,
    kind: z.literal("agent_message_chunk"),
    stepId,
    text: z.string(),
  }),
  z.object({
    ...seqRun,
    kind: z.literal("agent_thought_chunk"),
    stepId,
    text: z.string(),
  }),
  z.object({
    ...seqRun,
    kind: z.literal("tool_call"),
    stepId,
    id: z.string().min(1),
    title: z.string(),
    toolKind: z.string(),
    status: z.string(),
  }),
  z.object({
    ...seqRun,
    kind: z.literal("tool_call_update"),
    stepId,
    id: z.string().min(1),
    status: z.string(),
    content: z.unknown().optional(),
  }),
  z.object({
    ...seqRun,
    kind: z.literal("plan"),
    stepId,
    entries: z.array(planEntrySchema),
  }),
  z.object({
    ...seqRun,
    kind: z.literal("todos"),
    stepId,
    entries: z.array(cursorPlanTodoSchema),
  }),
  z.object({
    ...seqRun,
    kind: z.literal("subagent"),
    stepId,
    id: z.string().min(1),
    description: z.string().min(1),
    subagentType: z.string().min(1),
    durationMs: z.number().nonnegative().optional(),
  }),
  z.object({
    ...seqRun,
    kind: z.literal("usage"),
    stepId,
    used: z.number(),
    size: z.number(),
    cost: moneySchema.optional(),
  }),
  z.object({
    ...seqRun,
    kind: z.literal("log_chunk"),
    stepId: stepId.optional(),
    chunk: logChunkSchema,
  }),
] as const

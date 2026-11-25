import { z } from "zod"
import { engineEventSchema } from "./events.ts"
import { logChunkSchema } from "./runs-artifacts.ts"
import { runDetailSchema } from "./runs-detail.ts"
import { runSummarySchema } from "./runs-summary.ts"

/** Client → server websocket messages. */
export const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe_run"),
    runId: z.string().min(1),
    afterSeq: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("unsubscribe_run"),
    runId: z.string().min(1),
  }),
  z.object({
    type: z.literal("subscribe_log"),
    runId: z.string().min(1),
    taskId: z.string().min(1),
    attempt: z.number().int().positive(),
    stream: z.enum(["stdout", "stderr"]),
    offset: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("unsubscribe_log"),
    runId: z.string().min(1),
    taskId: z.string().min(1),
    attempt: z.number().int().positive(),
    stream: z.enum(["stdout", "stderr"]),
  }),
  z.object({
    type: z.literal("subscribe_workflow"),
    workflowId: z.string().min(1),
  }),
  z.object({
    type: z.literal("unsubscribe_workflow"),
    workflowId: z.string().min(1),
  }),
])

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>

/** Server → client websocket messages. */
export const wsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello") }),
  z.object({
    type: z.literal("engine_event"),
    seq: z.number().int().positive(),
    event: engineEventSchema,
  }),
  z.object({
    type: z.literal("run_snapshot"),
    run: runDetailSchema,
  }),
  z.object({
    type: z.literal("log_chunk"),
    runId: z.string().min(1),
    taskId: z.string().min(1),
    attempt: z.number().int().positive(),
    chunk: logChunkSchema,
  }),
  z.object({
    type: z.literal("file_changed"),
    workflowId: z.string().min(1),
    path: z.string().min(1),
    hash: z.string().min(1),
    content: z.string(),
  }),
  z.object({
    type: z.literal("runs_changed"),
    runId: z.string().min(1),
    /** Null when the run was deleted (DES-025 / BL-033). */
    summary: runSummarySchema.nullable(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string().min(1),
  }),
])

export type WsServerMessage = z.infer<typeof wsServerMessageSchema>

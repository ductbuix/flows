import { z } from "zod"
import { attemptKindInfoSchema } from "./attempt-kind.ts"
import {
  engineEventSchema,
  runStatusSchema,
  taskStatusSchema,
} from "./events.ts"
import { workflowSchema } from "./workflow.ts"

export const workflowSummarySchema = z.object({
  id: z.string().min(1),
  goal: z.string().optional(),
})

export type WorkflowSummary = z.infer<typeof workflowSummarySchema>

export const runSummarySchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  status: runStatusSchema,
  startedAt: z.string().min(1),
  finishedAt: z.string().optional(),
  taskCounts: z.object({
    total: z.number().int().nonnegative(),
    finished: z.number().int().nonnegative(),
    awaitingApproval: z.number().int().nonnegative(),
  }),
})

export type RunSummary = z.infer<typeof runSummarySchema>

export const attemptViewSchema = z.object({
  attempt: z.number().int().positive(),
  pid: z.number().int().positive().optional(),
  exitCode: z.number().int().optional(),
  interrupted: z.boolean().optional(),
  kind: attemptKindInfoSchema,
})

export type AttemptView = z.infer<typeof attemptViewSchema>

export const taskViewSchema = z.object({
  id: z.string().min(1),
  status: taskStatusSchema,
  spawned: z.boolean(),
  spawnedBy: z.string().optional(),
  failReason: z.enum(["rejected"]).optional(),
  skipReason: z.enum(["when", "upstream_skip", "branch"]).optional(),
  attempts: z.array(attemptViewSchema),
})

export type TaskView = z.infer<typeof taskViewSchema>

export const runDetailSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  status: runStatusSchema,
  startedAt: z.string().min(1),
  finishedAt: z.string().optional(),
  sandboxed: z.boolean(),
  lastSeq: z.number().int().nonnegative(),
  graph: workflowSchema,
  tasks: z.array(taskViewSchema),
  taskCounts: z.object({
    total: z.number().int().nonnegative(),
    finished: z.number().int().nonnegative(),
    awaitingApproval: z.number().int().nonnegative(),
  }),
})

export type RunDetail = z.infer<typeof runDetailSchema>

export const logChunkSchema = z.object({
  stream: z.enum(["stdout", "stderr"]),
  offset: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative(),
  text: z.string(),
  eof: z.boolean(),
})

export type LogChunk = z.infer<typeof logChunkSchema>

export const summaryResponseSchema = z.object({
  text: z.string().nullable(),
  missing: z.boolean(),
})

export type SummaryResponse = z.infer<typeof summaryResponseSchema>

export const outFileSchema = z.object({
  path: z.string().min(1),
  type: z.enum(["file", "dir"]),
})

export const outListSchema = z.object({
  files: z.array(outFileSchema),
})

export type OutList = z.infer<typeof outListSchema>

export const startRunResponseSchema = z.object({
  runId: z.string().min(1),
})

export type StartRunResponse = z.infer<typeof startRunResponseSchema>

export const yamlDiagnosticSchema = z.object({
  message: z.string().min(1),
  path: z.array(z.union([z.string(), z.number()])),
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  severity: z.literal("error"),
})

export type YamlDiagnosticDto = z.infer<typeof yamlDiagnosticSchema>

export const workflowDetailSchema = z.object({
  id: z.string().min(1),
  yaml: z.string(),
  hash: z.string().min(1),
  workflow: workflowSchema.nullable(),
  errors: z.array(yamlDiagnosticSchema),
})

export type WorkflowDetail = z.infer<typeof workflowDetailSchema>

export const putWorkflowBodySchema = z.object({
  yaml: z.string(),
  baseHash: z.string().min(1),
})

export type PutWorkflowBody = z.infer<typeof putWorkflowBodySchema>

export const workflowConflictSchema = z.object({
  message: z.literal("conflict"),
  diskYaml: z.string(),
  diskHash: z.string().min(1),
})

export type WorkflowConflict = z.infer<typeof workflowConflictSchema>

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
    type: z.literal("error"),
    message: z.string().min(1),
  }),
])

export type WsServerMessage = z.infer<typeof wsServerMessageSchema>

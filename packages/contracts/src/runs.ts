import { z } from "zod"
import { connectionIdSchema } from "./ids.ts"
import {
  engineEventSchema,
  runStatusSchema,
  taskStatusSchema,
} from "./events.ts"
import { effortSchema } from "./model-effort.ts"
import { workflowSchema } from "./nodes/index.ts"
import { layoutFileSchema } from "./nodes/layout.ts"

export const workflowSummarySchema = z.object({
  id: z.string().min(1),
  /** Optional display name from workflow.yaml (BL-073). */
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  /** Declared task count from workflow.yaml (DES-025 Workflows table). */
  taskCount: z.number().int().nonnegative(),
})

export type WorkflowSummary = z.infer<typeof workflowSummarySchema>

/** One task waiting on a person (DES-025); connectionId comes with publish. */
export const needsYouEntrySchema = z.object({
  taskId: z.string().min(1),
  connectionId: z.string().min(1).optional(),
  /** Approval node: the question to answer (BL-080). */
  question: z.string().optional(),
})

export type NeedsYouEntry = z.infer<typeof needsYouEntrySchema>

export const runSummarySchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  /** Display name; today the workflow id (DES-025). */
  workflowName: z.string().min(1),
  status: runStatusSchema,
  needsYou: z.array(needsYouEntrySchema),
  taskCounts: z.object({
    done: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  firstFailedTaskId: z.string().min(1).optional(),
  itemKey: z.string().min(1).optional(),
  /** Docket card this run belongs to (DES-038 / BL-039). */
  cardId: z.string().min(1).optional(),
  startedAt: z.string().min(1),
  finishedAt: z.string().optional(),
})

export type RunSummary = z.infer<typeof runSummarySchema>

export const taskViewSchema = z.object({
  id: z.string().min(1),
  status: taskStatusSchema,
  attempts: z.array(
    z.object({
      attempt: z.number().int().positive(),
      pid: z.number().int().positive().optional(),
      exitCode: z.number().int().optional(),
      interrupted: z.boolean().optional(),
      reason: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      effort: effortSchema.optional(),
      modelSource: z.enum(["task", "workflow", "cli"]).optional(),
    })
  ),
})

export type TaskView = z.infer<typeof taskViewSchema>

/** One library pin on a run view (DES-025 / BL-046). */
export const runLibraryPinSchema = z.object({
  connection: connectionIdSchema,
  kind: z.string().min(1),
  entityId: z.string().min(1),
  revision: z.string().min(1),
  title: z.string().min(1),
  fresh: z.boolean(),
  usedByTaskIds: z.array(z.string().min(1)),
})

export type RunLibraryPin = z.infer<typeof runLibraryPinSchema>

/** One row in the run effects ledger (DES-026 / BL-051). */
export const runEffectSchema = z.object({
  what: z.string().min(1),
  connection: connectionIdSchema,
  impact: z.enum(["read", "local", "cloud"]),
  result: z.string().min(1).optional(),
  undoNote: z.string().min(1).optional(),
})

export type RunEffect = z.infer<typeof runEffectSchema>

/** One pass of one node in a node run (BL-087). */
export const runStepSchema = z.object({
  nodeId: z.string().min(1),
  kind: z.string().min(1),
  pass: z.number().int().positive(),
  /** Attempts started in this pass. */
  attempts: z.number().int().nonnegative(),
  status: taskStatusSchema,
  /** Branch a Judge took: `yes` or `no`. */
  branch: z.string().min(1).optional(),
  /** Why the step failed, as the engine wrote it (`unclear` for a Judge). */
  failReason: z.string().min(1).optional(),
  /** Approval step: the question and the decision a person made. */
  question: z.string().optional(),
  decision: z.enum(["approved", "rejected"]).optional(),
  /** Agent and LLM steps with named answers (BL-085). */
  answer: z.record(z.string(), z.unknown()).optional(),
  /** Copied from an earlier run by Run step or Run from here (BL-102). */
  reused: z.literal(true).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
})

export type RunStep = z.infer<typeof runStepSchema>

/** Frozen canvas of a node run: graph, layout and node text (BL-087). */
export const runCanvasSchema = z.object({
  workflow: workflowSchema,
  layout: layoutFileSchema,
  /** Frozen node text files by path, e.g. `nodes/plan/prompt.md`. */
  texts: z.record(z.string(), z.string()),
})

export type RunCanvas = z.infer<typeof runCanvasSchema>

export const runDetailSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  status: runStatusSchema,
  /** Docket card this run belongs to, when started from one. */
  cardId: z.string().min(1).optional(),
  startedAt: z.string().min(1),
  finishedAt: z.string().optional(),
  sandboxed: z.boolean(),
  lastSeq: z.number().int().nonnegative(),
  graph: workflowSchema,
  tasks: z.array(taskViewSchema),
  /** Node runs only: one entry per pass of each node (BL-087). */
  steps: z.array(runStepSchema).optional(),
  taskCounts: z.object({
    total: z.number().int().nonnegative(),
    finished: z.number().int().nonnegative(),
    awaitingApproval: z.number().int().nonnegative(),
  }),
  /** Relative paths under runs/<id>/input/ (DES-021). */
  inputFiles: z.array(z.string()).default([]),
  /** Frozen library pins for this run (BL-046). */
  pins: z.array(runLibraryPinSchema).default([]),
  /** Effects ledger derived from events (DES-026 / BL-051). */
  effects: z.array(runEffectSchema).default([]),
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
  /** queued when over maxConcurrentRuns (DES-021). */
  status: z.enum(["queued", "running"]),
})

export type StartRunResponse = z.infer<typeof startRunResponseSchema>

/** Client request id for idempotent mutating actions (DES-011). */
export const requestIdBodySchema = z.object({
  requestId: z.string().min(1),
})

export type RequestIdBody = z.infer<typeof requestIdBodySchema>

export const okResponseSchema = z.object({
  ok: z.literal(true),
})

export type OkResponse = z.infer<typeof okResponseSchema>

export const apiErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
})

export type ApiError = z.infer<typeof apiErrorSchema>

export const yamlDiagnosticSchema = z.object({
  message: z.string().min(1),
  path: z.array(z.union([z.string(), z.number()])),
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  severity: z.literal("error"),
})

export type YamlDiagnosticDto = z.infer<typeof yamlDiagnosticSchema>

/** Workflow detail: `workflow` is the parsed node workflow. */
export const workflowDetailSchema = z.object({
  id: z.string().min(1),
  yaml: z.string(),
  hash: z.string().min(1),
  workflow: workflowSchema.nullable(),
  errors: z.array(yamlDiagnosticSchema),
  /** Editor positions; empty when `workflow.layout.json` is missing. */
  layout: layoutFileSchema.default({ version: 1, nodes: {} }),
})

export type WorkflowDetail = z.infer<typeof workflowDetailSchema>

export const putWorkflowBodySchema = z.object({
  yaml: z.string(),
  baseHash: z.string().min(1),
  /** Node id renames in this save ; moves the node folder. */
  renames: z
    .array(z.object({ from: z.string().min(1), to: z.string().min(1) }))
    .optional(),
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

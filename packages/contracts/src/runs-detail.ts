import { z } from "zod"
import { connectionIdSchema } from "./ids.ts"
import { runStatusSchema, taskStatusSchema } from "./events.ts"
import { effortSchema } from "./model-effort.ts"
import { workflowSchema } from "./nodes/index.ts"
import { layoutFileSchema } from "./nodes/layout.ts"

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

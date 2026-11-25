import { z } from "zod"
import { runStatusSchema } from "./events.ts"

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

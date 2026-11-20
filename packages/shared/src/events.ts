import { z } from "zod"
import { workflowSchema } from "./workflow.ts"

export const taskStatusSchema = z.enum([
  "pending",
  "awaiting_approval",
  "running",
  "succeeded",
  "failed",
  "cancelled",
])

export const runStatusSchema = z.enum([
  "running",
  "succeeded",
  "failed",
  "cancelled",
])

export type TaskStatus = z.infer<typeof taskStatusSchema>
export type RunStatus = z.infer<typeof runStatusSchema>

const eventBase = {
  runId: z.string().min(1),
  at: z.string().min(1),
}

export const runStartedEventSchema = z.object({
  type: z.literal("run_started"),
  ...eventBase,
  workflowId: z.string().min(1),
  graph: workflowSchema,
})

export const attemptStartedEventSchema = z.object({
  type: z.literal("attempt_started"),
  ...eventBase,
  taskId: z.string().min(1),
  attempt: z.number().int().positive(),
})

export const attemptLaunchedEventSchema = z.object({
  type: z.literal("attempt_launched"),
  ...eventBase,
  taskId: z.string().min(1),
  attempt: z.number().int().positive(),
  pid: z.number().int().positive(),
})

export const attemptFinishedEventSchema = z.object({
  type: z.literal("attempt_finished"),
  ...eventBase,
  taskId: z.string().min(1),
  attempt: z.number().int().positive(),
  exitCode: z.number().int(),
})

/** Open attempt could not be re-attached after a restart (DES-003). */
export const attemptInterruptedEventSchema = z.object({
  type: z.literal("attempt_interrupted"),
  ...eventBase,
  taskId: z.string().min(1),
  attempt: z.number().int().positive(),
})

export const approvalRequestedEventSchema = z.object({
  type: z.literal("approval_requested"),
  ...eventBase,
  taskId: z.string().min(1),
})

export const taskApprovedEventSchema = z.object({
  type: z.literal("task_approved"),
  ...eventBase,
  taskId: z.string().min(1),
})

export const taskRejectedEventSchema = z.object({
  type: z.literal("task_rejected"),
  ...eventBase,
  taskId: z.string().min(1),
  reason: z.literal("rejected"),
})

export const cancelRequestedEventSchema = z.object({
  type: z.literal("cancel_requested"),
  ...eventBase,
})

export const taskCancelledEventSchema = z.object({
  type: z.literal("task_cancelled"),
  ...eventBase,
  taskId: z.string().min(1),
})

export const runCancelledEventSchema = z.object({
  type: z.literal("run_cancelled"),
  ...eventBase,
})

export const runSucceededEventSchema = z.object({
  type: z.literal("run_succeeded"),
  ...eventBase,
})

export const runFailedEventSchema = z.object({
  type: z.literal("run_failed"),
  ...eventBase,
})

/** Marker: run files removed; fold hides the run (DES-003). */
export const runDeletedEventSchema = z.object({
  type: z.literal("run_deleted"),
  ...eventBase,
})

export const engineEventSchema = z.discriminatedUnion("type", [
  runStartedEventSchema,
  attemptStartedEventSchema,
  attemptLaunchedEventSchema,
  attemptFinishedEventSchema,
  attemptInterruptedEventSchema,
  approvalRequestedEventSchema,
  taskApprovedEventSchema,
  taskRejectedEventSchema,
  cancelRequestedEventSchema,
  taskCancelledEventSchema,
  runCancelledEventSchema,
  runSucceededEventSchema,
  runFailedEventSchema,
  runDeletedEventSchema,
])

export type EngineEvent = z.infer<typeof engineEventSchema>
export type RunStartedEvent = z.infer<typeof runStartedEventSchema>

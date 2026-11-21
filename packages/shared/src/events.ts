import { z } from "zod"
import { effortSchema } from "./model-effort.ts"
import { taskSchema, workflowSchema } from "./workflow.ts"

export const taskStatusSchema = z.enum([
  "pending",
  "awaiting_approval",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
])

export const runStatusSchema = z.enum([
  "queued",
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
  /** Trust-once for this run so resume does not re-ask (DES-019). */
  trustGrant: z.literal("once").optional(),
  /** Input source id (DES-021). */
  source: z.literal("manual").optional(),
  itemKey: z.string().min(1).optional(),
  inputHash: z.string().min(1).optional(),
  /** Relative paths under runs/<id>/input/ (DES-021). */
  files: z.array(z.string()).optional(),
  /** True when the run waits under maxConcurrentRuns (DES-021). */
  queued: z.boolean().optional(),
})

/** Queued run becomes running when a slot frees (DES-021). */
export const runActivatedEventSchema = z.object({
  type: z.literal("run_activated"),
  ...eventBase,
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
  /** False when sandbox-exec was not applied (DES-006). */
  sandboxed: z.boolean().optional(),
  /** Resolved timeout in seconds for this attempt (DES-019). */
  timeout: z.number().int().positive().optional(),
  /** Resolved model for agent attempts (DES-023). */
  model: z.string().min(1).optional(),
  /** Resolved effort for agent attempts (DES-023). */
  effort: effortSchema.optional(),
  /** Where model/effort came from (DES-023). */
  modelSource: z.enum(["task", "workflow", "cli"]).optional(),
})

export const attemptFinishedEventSchema = z.object({
  type: z.literal("attempt_finished"),
  ...eventBase,
  taskId: z.string().min(1),
  attempt: z.number().int().positive(),
  exitCode: z.number().int(),
  /** timeout, mapped CLI stderr, or omitted (DES-019). */
  reason: z.string().min(1).optional(),
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

/** Scheduler decided the task succeeded (after loops / until). */
export const taskSucceededEventSchema = z.object({
  type: z.literal("task_succeeded"),
  ...eventBase,
  taskId: z.string().min(1),
})

/** Scheduler decided the task failed (retries exhausted or until max). */
export const taskFailedEventSchema = z.object({
  type: z.literal("task_failed"),
  ...eventBase,
  taskId: z.string().min(1),
})

/** when false, branch edge miss, or upstream skip (DES-004). */
export const taskSkippedEventSchema = z.object({
  type: z.literal("task_skipped"),
  ...eventBase,
  taskId: z.string().min(1),
  reason: z.enum(["when", "upstream_skip", "branch"]),
})

/** Agent spawned tasks into this run's graph (DES-005 / BL-007). */
export const tasksSpawnedEventSchema = z.object({
  type: z.literal("tasks_spawned"),
  ...eventBase,
  parentTaskId: z.string().min(1),
  tasks: z.array(taskSchema).min(1),
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

/**
 * Manual retry from the UI (DES-011). Resets the task and its
 * dependants to pending and reopens a finished run.
 */
export const taskRetryRequestedEventSchema = z.object({
  type: z.literal("task_retry_requested"),
  ...eventBase,
  taskId: z.string().min(1),
})

export const engineEventSchema = z.discriminatedUnion("type", [
  runStartedEventSchema,
  runActivatedEventSchema,
  attemptStartedEventSchema,
  attemptLaunchedEventSchema,
  attemptFinishedEventSchema,
  attemptInterruptedEventSchema,
  approvalRequestedEventSchema,
  taskApprovedEventSchema,
  taskRejectedEventSchema,
  taskSucceededEventSchema,
  taskFailedEventSchema,
  taskSkippedEventSchema,
  tasksSpawnedEventSchema,
  cancelRequestedEventSchema,
  taskCancelledEventSchema,
  runCancelledEventSchema,
  runSucceededEventSchema,
  runFailedEventSchema,
  runDeletedEventSchema,
  taskRetryRequestedEventSchema,
])

export type EngineEvent = z.infer<typeof engineEventSchema>
export type RunStartedEvent = z.infer<typeof runStartedEventSchema>
export type RunActivatedEvent = z.infer<typeof runActivatedEventSchema>

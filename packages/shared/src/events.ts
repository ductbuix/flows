import { z } from "zod"
import { workflowSchema } from "./workflow.ts"

export const taskStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
])

export const runStatusSchema = z.enum(["running", "succeeded", "failed"])

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

export const runSucceededEventSchema = z.object({
  type: z.literal("run_succeeded"),
  ...eventBase,
})

export const runFailedEventSchema = z.object({
  type: z.literal("run_failed"),
  ...eventBase,
})

export const engineEventSchema = z.discriminatedUnion("type", [
  runStartedEventSchema,
  attemptStartedEventSchema,
  attemptLaunchedEventSchema,
  attemptFinishedEventSchema,
  attemptInterruptedEventSchema,
  runSucceededEventSchema,
  runFailedEventSchema,
])

export type EngineEvent = z.infer<typeof engineEventSchema>
export type RunStartedEvent = z.infer<typeof runStartedEventSchema>

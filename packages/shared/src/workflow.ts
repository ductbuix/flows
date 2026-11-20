import { z } from "zod"

/** Command task as supported by the engine core (BL-004). */
export const commandTaskSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("command"),
  run: z.string().min(1),
  needs: z.array(z.string().min(1)).default([]),
})

export const workflowLimitsSchema = z.object({
  concurrency: z.number().int().positive().optional(),
  agents: z.number().int().positive().optional(),
  maxTasks: z.number().int().positive().optional(),
  maxSpawnDepth: z.number().int().nonnegative().optional(),
})

export const workflowSchema = z.object({
  id: z.string().min(1),
  goal: z.string().optional(),
  limits: workflowLimitsSchema.optional(),
  tasks: z.array(commandTaskSchema).min(1),
})

export type CommandTask = z.infer<typeof commandTaskSchema>
export type Workflow = z.infer<typeof workflowSchema>
export type WorkflowLimits = z.infer<typeof workflowLimitsSchema>

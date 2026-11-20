import { z } from "zod"

/** Leaf and combined conditions (DES-004). Agent kind is BL-011. */
export type Condition =
  | { exit: number | number[] }
  | { expr: string }
  | { all: Condition[] }
  | { any: Condition[] }

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({
      exit: z.union([z.number().int(), z.array(z.number().int()).min(1)]),
    }),
    z.object({ expr: z.string().min(1) }),
    z.object({ all: z.array(conditionSchema).min(1) }),
    z.object({ any: z.array(conditionSchema).min(1) }),
  ])
)

export const whenSchema = z.union([z.boolean(), conditionSchema])

export const needObjectSchema = z.object({
  task: z.string().min(1),
  when: conditionSchema.optional(),
  allowSkipped: z.boolean().optional(),
})

export const needSchema = z.union([z.string().min(1), needObjectSchema])

export const retrySchema = z.object({
  max: z.number().int().positive().default(3),
})

export const repeatSchema = z.object({
  max: z.number().int().positive().default(5),
  until: conditionSchema,
})

/** Command task as supported by the engine (BL-004, BL-006, BL-014). */
export const commandTaskSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("command"),
  run: z.string().min(1),
  needs: z.array(needSchema).default([]),
  /** Gate before the first launch; retries do not ask again (DES-003). */
  approval: z.boolean().optional(),
  when: whenSchema.optional(),
  retry: retrySchema.optional(),
  repeat: repeatSchema.optional(),
  continueOnError: z.boolean().optional(),
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

export type Need = z.infer<typeof needSchema>
export type NeedObject = z.infer<typeof needObjectSchema>
export type When = z.infer<typeof whenSchema>
export type RetryPolicy = z.infer<typeof retrySchema>
export type RepeatPolicy = z.infer<typeof repeatSchema>
export type CommandTask = z.infer<typeof commandTaskSchema>
export type Workflow = z.infer<typeof workflowSchema>
export type WorkflowLimits = z.infer<typeof workflowLimitsSchema>

export function needTaskId(need: Need): string {
  return typeof need === "string" ? need : need.task
}

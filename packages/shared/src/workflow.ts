import { z } from "zod"

/** Agent judge leaf (DES-004 / BL-011). */
export const agentJudgeSchema = z.object({
  cli: z.enum(["claude", "cursor"]),
  /** Path relative to the workflow dir. */
  instructions: z.string().min(1),
})

export type AgentJudge = z.infer<typeof agentJudgeSchema>

/** Leaf and combined conditions (DES-004). */
export type Condition =
  | { exit: number | number[] }
  | { expr: string }
  | { agent: AgentJudge }
  | { all: Condition[] }
  | { any: Condition[] }

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({
      exit: z.union([z.number().int(), z.array(z.number().int()).min(1)]),
    }),
    z.object({ expr: z.string().min(1) }),
    z.object({ agent: agentJudgeSchema }),
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

const taskBaseFields = {
  id: z.string().min(1),
  needs: z.array(needSchema).default([]),
  /** Gate before the first launch; retries do not ask again (DES-003). */
  approval: z.boolean().optional(),
  when: whenSchema.optional(),
  retry: retrySchema.optional(),
  repeat: repeatSchema.optional(),
  continueOnError: z.boolean().optional(),
  /**
   * Engine-stamped for spawned tasks (DES-005). Authored tasks are depth 0.
   */
  spawnDepth: z.number().int().nonnegative().optional(),
  /** Engine-stamped parent agent id when this task was spawned. */
  spawnedBy: z.string().min(1).optional(),
}

/** Command task (BL-004, BL-006, BL-014). */
export const commandTaskSchema = z.object({
  ...taskBaseFields,
  kind: z.literal("command"),
  run: z.string().min(1),
  /** Path relative to the workflow dir (DES-002). */
  instructions: z.string().min(1).optional(),
})

/** Agent CLI task (BL-007 / DES-005). */
export const agentTaskSchema = z.object({
  ...taskBaseFields,
  kind: z.literal("agent"),
  cli: z.enum(["claude", "cursor"]),
  /** Path relative to the workflow dir; the agent's prompt (DES-002). */
  instructions: z.string().min(1),
  /** Workflow-relative memory/*.md paths copied to input/memory/. */
  memory: z.array(z.string().min(1)).optional(),
  /** When true, engine reads out/spawn/*.yaml after a successful attempt. */
  spawn: z.boolean().optional(),
})

export const taskSchema = z.discriminatedUnion("kind", [
  commandTaskSchema,
  agentTaskSchema,
])

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
  tasks: z.array(taskSchema).min(1),
})

/** Global limits in ~/.flowapp/config.yaml (DES-002, DES-003). */
export const appConfigSchema = z.object({
  limits: workflowLimitsSchema.optional(),
})

export type Need = z.infer<typeof needSchema>
export type NeedObject = z.infer<typeof needObjectSchema>
export type When = z.infer<typeof whenSchema>
export type RetryPolicy = z.infer<typeof retrySchema>
export type RepeatPolicy = z.infer<typeof repeatSchema>
export type CommandTask = z.infer<typeof commandTaskSchema>
export type AgentTask = z.infer<typeof agentTaskSchema>
export type Task = z.infer<typeof taskSchema>
export type Workflow = z.infer<typeof workflowSchema>
export type WorkflowLimits = z.infer<typeof workflowLimitsSchema>
export type AppConfig = z.infer<typeof appConfigSchema>

export function needTaskId(need: Need): string {
  return typeof need === "string" ? need : need.task
}

export function isAgentTask(task: Task): task is AgentTask {
  return task.kind === "agent"
}

export function isCommandTask(task: Task): task is CommandTask {
  return task.kind === "command"
}

export function taskSpawnDepth(task: Task): number {
  return task.spawnDepth ?? 0
}

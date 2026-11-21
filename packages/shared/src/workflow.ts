import { z } from "zod"
import { connectionIdSchema, taskUsesSchema } from "./connection.ts"
import { isSafeTaskId } from "./task-ids.ts"
import {
  effortSchema,
  modelIdSchema,
  workflowAgentSchema,
} from "./model-effort.ts"

/** Agent judge leaf; optional model/effort (DES-020, DES-023). */
export const agentJudgeSchema = z.object({
  cli: z.enum(["claude", "cursor"]),
  model: modelIdSchema.optional(),
  effort: effortSchema.optional(),
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

/** Positive seconds; task → workflow → 900 (DES-004 / DES-019). */
export const timeoutSecondsSchema = z.number().int().positive()

const taskIdSchema = z
  .string()
  .min(1)
  .refine(isSafeTaskId, "task id must be a single path segment")

const taskBaseFields = {
  id: taskIdSchema,
  /** Display label; falls back to id when missing (DES-020). */
  name: z.string().optional(),
  needs: z.array(needSchema).default([]),
  /** Gate before the first launch; retries do not ask again (DES-003). */
  approval: z.boolean().optional(),
  when: whenSchema.optional(),
  retry: retrySchema.optional(),
  repeat: repeatSchema.optional(),
  continueOnError: z.boolean().optional(),
  /** Per-attempt timeout in seconds (DES-019). */
  timeout: timeoutSecondsSchema.optional(),
  /**
   * Engine-stamped for spawned tasks (DES-005). Authored tasks are depth 0.
   */
  spawnDepth: z.number().int().nonnegative().optional(),
  /** Engine-stamped parent agent id when this task was spawned. */
  spawnedBy: z.string().min(1).optional(),
  /**
   * Engine-stamped run-root-relative prompt folder for spawned tasks
   * (DES-020). Authored tasks omit this and use `tasks/<id>/`.
   */
  promptDir: z.string().min(1).optional(),
  /** Outside systems this task reads or proposes against (DES-026). */
  uses: taskUsesSchema.optional(),
}

/** Command task (BL-004, BL-006, BL-014). */
export const commandTaskSchema = z.object({
  ...taskBaseFields,
  kind: z.literal("command"),
  run: z.string().min(1),
})

/** Agent CLI task (BL-007 / DES-005 / DES-020 / DES-023). */
export const agentTaskSchema = z.object({
  ...taskBaseFields,
  kind: z.literal("agent"),
  cli: z.enum(["claude", "cursor"]),
  model: modelIdSchema.optional(),
  effort: effortSchema.optional(),
  /** Workflow-relative memory/*.md paths copied to input/memory/. */
  memory: z.array(z.string().min(1)).optional(),
  /** When true, engine reads out/spawn/*.yaml after a successful attempt. */
  spawn: z.boolean().optional(),
})

/**
 * Publish task: builds a change set and sends it under the connection
 * policy (DES-026 / BL-049). Runs no process. Shares base fields with
 * other kinds so the Task union stays easy to use.
 */
export const publishTaskSchema = z.object({
  ...taskBaseFields,
  kind: z.literal("publish"),
  connection: connectionIdSchema,
})

export const taskSchema = z.discriminatedUnion("kind", [
  commandTaskSchema,
  agentTaskSchema,
  publishTaskSchema,
])

export const workflowLimitsSchema = z.object({
  concurrency: z.number().int().positive().optional(),
  agents: z.number().int().positive().optional(),
  maxTasks: z.number().int().positive().optional(),
  maxSpawnDepth: z.number().int().nonnegative().optional(),
  /** Caps running runs per workflow; omitted means 1 (DES-021). */
  maxConcurrentRuns: z.number().int().positive().optional(),
})

const INPUT_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/
const RESERVED_INPUT_NAMES = new Set(["inputs", "attach"])

/** Declared workflow input field (DES-021). */
export const workflowInputDeclSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .refine(
        (n) => INPUT_NAME_RE.test(n) && !RESERVED_INPUT_NAMES.has(n),
        "input name must match ^[A-Za-z][A-Za-z0-9_-]*$ and not be reserved"
      ),
    type: z.enum(["text", "markdown", "file"]),
    required: z.boolean(),
    description: z.string().optional(),
    default: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.default !== undefined && val.type === "file") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "default is only allowed on text and markdown inputs",
        path: ["default"],
      })
    }
  })

export type WorkflowInputDecl = z.infer<typeof workflowInputDeclSchema>

const workflowInputsSchema = z
  .array(workflowInputDeclSchema)
  .superRefine((list, ctx) => {
    const seen = new Set<string>()
    for (let i = 0; i < list.length; i++) {
      const name = list[i]!.name
      if (seen.has(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate input name ${name}`,
          path: [i, "name"],
        })
      }
      seen.add(name)
    }
  })

export const workflowSchema = z.object({
  id: z.string().min(1),
  goal: z.string().optional(),
  limits: workflowLimitsSchema.optional(),
  /** Declared start-run form fields (DES-021). */
  inputs: workflowInputsSchema.optional(),
  /** Per-CLI model and effort defaults (DES-023). */
  agent: workflowAgentSchema.optional(),
  /** Default per-attempt timeout in seconds (DES-019). */
  timeout: timeoutSecondsSchema.optional(),
  tasks: z.array(taskSchema).min(1),
})

/** Default library size cap: 5 GB (DES-026 / BL-047). */
export const DEFAULT_LIBRARY_MAX_BYTES = 5 * 1024 * 1024 * 1024

/** Global limits in ~/.flowapp/config.yaml (DES-002, DES-003). */
export const appConfigSchema = z.object({
  limits: workflowLimitsSchema.optional(),
  library: z
    .object({
      maxBytes: z.number().int().positive().optional(),
    })
    .optional(),
})

export type Need = z.infer<typeof needSchema>
export type NeedObject = z.infer<typeof needObjectSchema>
export type When = z.infer<typeof whenSchema>
export type RetryPolicy = z.infer<typeof retrySchema>
export type RepeatPolicy = z.infer<typeof repeatSchema>
export type CommandTask = z.infer<typeof commandTaskSchema>
export type AgentTask = z.infer<typeof agentTaskSchema>
export type PublishTask = z.infer<typeof publishTaskSchema>
export type Task = z.infer<typeof taskSchema>
export type Workflow = z.infer<typeof workflowSchema>
export type WorkflowLimits = z.infer<typeof workflowLimitsSchema>
export type AppConfig = z.infer<typeof appConfigSchema>
export type WorkflowInputType = WorkflowInputDecl["type"]

export function needTaskId(need: Need): string {
  return typeof need === "string" ? need : need.task
}

/**
 * Lone `{ agent: ... }` leaf only. Combined all/any stay yaml-only
 * for model/effort in the drawer (DES-023).
 */
export function loneAgentJudge(
  condition: Condition | boolean | undefined
): AgentJudge | undefined {
  if (!condition || typeof condition === "boolean") return undefined
  if ("agent" in condition) return condition.agent
  return undefined
}

export function isAgentTask(task: Task): task is AgentTask {
  return task.kind === "agent"
}

export function isCommandTask(task: Task): task is CommandTask {
  return task.kind === "command"
}

export function isPublishTask(task: Task): task is PublishTask {
  return task.kind === "publish"
}

export function taskSpawnDepth(task: Task): number {
  return task.spawnDepth ?? 0
}

import { z } from "zod"
import { effortSchema, modelIdSchema } from "./model-effort.ts"

/** Agent judge leaf; optional model/effort (DES-020, DES-023). */
export const agentJudgeSchema = z.object({
  cli: z.enum(["claude", "cursor"]),
  model: modelIdSchema.optional(),
  effort: effortSchema.optional(),
})

export type AgentJudge = z.infer<typeof agentJudgeSchema>

export const retrySchema = z.object({
  max: z.number().int().positive().default(3),
})

/** Positive seconds; task → workflow → 900 (DES-004 / DES-019). */
export const timeoutSecondsSchema = z.number().int().positive()

export const workflowLimitsSchema = z.object({
  concurrency: z.number().int().positive().optional(),
  agents: z.number().int().positive().optional(),
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

/** Optional display label; the folder id stays the stable key (BL-073). */
export const workflowNameSchema = z.string().trim().min(1).max(80)

/** Default library size cap: 5 GB (DES-026 / BL-047). */
export const DEFAULT_LIBRARY_MAX_BYTES = 5 * 1024 * 1024 * 1024

/** Agent runtime selection (DES-039 M4 / DES-041). Default spawn. */
export const agentsConfigSchema = z.object({
  runtime: z.enum(["spawn", "acp"]).default("spawn"),
})

/** Global limits in ~/.flowapp/config.yaml (DES-002, DES-003). */
export const appConfigSchema = z.object({
  limits: workflowLimitsSchema.optional(),
  library: z
    .object({
      maxBytes: z.number().int().positive().optional(),
    })
    .optional(),
  agents: agentsConfigSchema.optional(),
})

export type RetryPolicy = z.infer<typeof retrySchema>
export type WorkflowLimits = z.infer<typeof workflowLimitsSchema>
export type AppConfig = z.infer<typeof appConfigSchema>
export type WorkflowInputType = WorkflowInputDecl["type"]

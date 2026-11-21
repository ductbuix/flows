import { z } from "zod"

/** Effort levels shared by Claude flags and Cursor family suffixes (DES-023). */
export const effortSchema = z.enum(["low", "medium", "high", "xhigh", "max"])
export type Effort = z.infer<typeof effortSchema>

export const EFFORTS: readonly Effort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]

/** Optional non-empty model id. */
export const modelIdSchema = z.string().min(1)

/** Per-CLI workflow defaults under `agent.<cli>` (DES-023). */
export const agentCliDefaultsSchema = z.object({
  model: modelIdSchema.optional(),
  effort: effortSchema.optional(),
})

export type AgentCliDefaults = z.infer<typeof agentCliDefaultsSchema>

export const workflowAgentSchema = z.object({
  claude: agentCliDefaultsSchema.optional(),
  cursor: agentCliDefaultsSchema.optional(),
})

export type WorkflowAgent = z.infer<typeof workflowAgentSchema>

export const cliModelEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  efforts: z.array(effortSchema),
})

export type CliModelEntry = z.infer<typeof cliModelEntrySchema>

/** GET /api/cli/:cli/models (DES-023). */
export const cliModelCatalogSchema = z.object({
  cli: z.enum(["claude", "cursor"]),
  defaultLabel: z.string().min(1),
  defaults: z.object({
    model: z.string().optional(),
    effort: effortSchema.optional(),
  }),
  models: z.array(cliModelEntrySchema),
  error: z.string().optional(),
})

export type CliModelCatalog = z.infer<typeof cliModelCatalogSchema>

export type ModelSource = "task" | "workflow" | "cli"

export type ResolvedModelEffort = {
  model?: string
  effort?: Effort
  modelSource: ModelSource
}

type ResolveInput = {
  judge?: { model?: string; effort?: Effort }
  task?: { cli: "claude" | "cursor"; model?: string; effort?: Effort }
  workflowAgent?: WorkflowAgent
  judgeCli?: "claude" | "cursor"
}

/**
 * Resolve model/effort: judge → same-cli parent task → workflow → omit
 * (CLI settings). Each field resolves independently (DES-023).
 */
export function resolveModelEffort(input: ResolveInput): ResolvedModelEffort {
  const cli = input.judgeCli ?? input.task?.cli
  const workflowDefaults =
    cli === "claude"
      ? input.workflowAgent?.claude
      : cli === "cursor"
        ? input.workflowAgent?.cursor
        : undefined

  const model = pickField(
    input.judge?.model,
    sameCliTask(input) ? input.task?.model : undefined,
    workflowDefaults?.model
  )
  const effort = pickField(
    input.judge?.effort,
    sameCliTask(input) ? input.task?.effort : undefined,
    workflowDefaults?.effort
  )

  const sources = [model.source, effort.source].filter(
    (s): s is ModelSource => s !== undefined
  )
  const modelSource: ModelSource = sources.includes("task")
    ? "task"
    : sources.includes("workflow")
      ? "workflow"
      : "cli"

  return {
    ...(model.value !== undefined ? { model: model.value } : {}),
    ...(effort.value !== undefined ? { effort: effort.value } : {}),
    modelSource,
  }
}

function sameCliTask(input: ResolveInput): boolean {
  if (!input.task) return false
  if (!input.judgeCli) return true
  return input.task.cli === input.judgeCli
}

function pickField<T>(
  judge: T | undefined,
  task: T | undefined,
  workflow: T | undefined
): { value: T | undefined; source?: ModelSource } {
  if (judge !== undefined) return { value: judge, source: "task" }
  if (task !== undefined) return { value: task, source: "task" }
  if (workflow !== undefined) return { value: workflow, source: "workflow" }
  return { value: undefined, source: undefined }
}

import { z } from "zod"
import { workflowSchema } from "./nodes/index.ts"
import { layoutFileSchema } from "./nodes/layout.ts"

export const yamlDiagnosticSchema = z.object({
  message: z.string().min(1),
  path: z.array(z.union([z.string(), z.number()])),
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  severity: z.literal("error"),
})

export type YamlDiagnosticDto = z.infer<typeof yamlDiagnosticSchema>

/** Workflow detail: `workflow` is the parsed node workflow. */
export const workflowDetailSchema = z.object({
  id: z.string().min(1),
  yaml: z.string(),
  hash: z.string().min(1),
  workflow: workflowSchema.nullable(),
  errors: z.array(yamlDiagnosticSchema),
  /** Editor positions; empty when `workflow.layout.json` is missing. */
  layout: layoutFileSchema.default({ version: 1, nodes: {} }),
})

export type WorkflowDetail = z.infer<typeof workflowDetailSchema>

export const putWorkflowBodySchema = z.object({
  yaml: z.string(),
  baseHash: z.string().min(1),
  /** Node id renames in this save ; moves the node folder. */
  renames: z
    .array(z.object({ from: z.string().min(1), to: z.string().min(1) }))
    .optional(),
})

export type PutWorkflowBody = z.infer<typeof putWorkflowBodySchema>

export const workflowConflictSchema = z.object({
  message: z.literal("conflict"),
  diskYaml: z.string(),
  diskHash: z.string().min(1),
})

export type WorkflowConflict = z.infer<typeof workflowConflictSchema>

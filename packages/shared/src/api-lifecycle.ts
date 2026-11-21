import { z } from "zod"

/** Workflow dir name / id: lowercase letters, digits and dashes (DES-013). */
export const workflowIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and dashes")

export const createWorkflowBodySchema = z.object({
  id: workflowIdSchema,
  goal: z.string().min(1),
})

export type CreateWorkflowBody = z.infer<typeof createWorkflowBodySchema>

export const renameWorkflowBodySchema = z.object({
  newId: workflowIdSchema,
})

export type RenameWorkflowBody = z.infer<typeof renameWorkflowBodySchema>

export const renameWorkflowResponseSchema = z.object({
  id: workflowIdSchema,
})

export type RenameWorkflowResponse = z.infer<
  typeof renameWorkflowResponseSchema
>

/** Basename only: *.md, no path separators (DES-013). */
export const memoryFileNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9._-]+\.md$/, "memory file must be a .md basename")

export const memoryFileSummarySchema = z.object({
  name: memoryFileNameSchema,
  hash: z.string().min(1),
  referencedBy: z.array(z.string().min(1)),
})

export type MemoryFileSummary = z.infer<typeof memoryFileSummarySchema>

export const memoryListSchema = z.object({
  files: z.array(memoryFileSummarySchema),
})

export type MemoryList = z.infer<typeof memoryListSchema>

export const memoryFileDetailSchema = z.object({
  name: memoryFileNameSchema,
  content: z.string(),
  hash: z.string().min(1),
  referencedBy: z.array(z.string().min(1)),
})

export type MemoryFileDetail = z.infer<typeof memoryFileDetailSchema>

export const putMemoryBodySchema = z.object({
  content: z.string(),
  baseHash: z.string().min(1).optional(),
})

export type PutMemoryBody = z.infer<typeof putMemoryBodySchema>

export const renameMemoryBodySchema = z.object({
  newName: memoryFileNameSchema,
  updateReferences: z.boolean().optional(),
})

export type RenameMemoryBody = z.infer<typeof renameMemoryBodySchema>

export const memoryConflictSchema = z.object({
  message: z.literal("conflict"),
  diskContent: z.string(),
  diskHash: z.string().min(1),
})

export type MemoryConflict = z.infer<typeof memoryConflictSchema>

/**
 * Workflow-relative text path (DES-018). Relative only; no `..`, absolute,
 * backslashes, `workflow.yaml`, anything under `runs/` or `.cache/`
 * (DES-026), or `tasks/.trash/` (DES-022).
 */
export function isAllowedWorkflowFilePath(rel: string): boolean {
  if (!rel || rel.startsWith("/") || rel.includes("\\")) return false
  const parts = rel.split("/")
  if (parts.some((p) => !p || p === "." || p === "..")) return false
  if (rel === "workflow.yaml") return false
  if (parts[0] === "runs") return false
  if (parts[0] === ".cache") return false
  if (parts[0] === "tasks" && parts[1] === ".trash") return false
  return true
}

/** PUT conflict when a removed task is still in a live or queued run (DES-022). */
export const taskInLiveRunErrorSchema = z.object({
  error: z.literal("task_in_live_run"),
  taskIds: z.array(z.string().min(1)).min(1),
  runIds: z.array(z.string().min(1)).min(1),
})

export type TaskInLiveRunError = z.infer<typeof taskInLiveRunErrorSchema>

export const workflowFilePathSchema = z
  .string()
  .min(1)
  .refine(isAllowedWorkflowFilePath, "invalid workflow-relative path")

export const workflowFileDetailSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  hash: z.string().min(1),
})

export type WorkflowFileDetail = z.infer<typeof workflowFileDetailSchema>

export const putWorkflowFileBodySchema = z.object({
  content: z.string(),
  baseHash: z.string().min(1).optional(),
})

export type PutWorkflowFileBody = z.infer<typeof putWorkflowFileBodySchema>

export const workflowFileConflictSchema = memoryConflictSchema

export type WorkflowFileConflict = MemoryConflict

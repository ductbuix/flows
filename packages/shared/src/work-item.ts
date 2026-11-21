import { z } from "zod"
import { workflowIdSchema } from "./api-lifecycle.ts"
import { connectionIdSchema } from "./connection.ts"

/** Work item folder id: lowercase letters, digits and dashes (DES-026). */
export const workItemIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and dashes")

/** Ad hoc, or a Rally story/defect (DES-026 / BL-055). Links stay BL-046. */
export const workItemSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("adhoc"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("rally"),
      connection: connectionIdSchema,
      entityKind: z.enum(["story", "defect"]),
      entityId: z.string().min(1),
    })
    .strict(),
])

/**
 * Saved work item record (DES-026 / BL-038). Unknown keys are errors.
 * `links` stays empty until BL-046.
 */
export const workItemSchema = z
  .object({
    id: workItemIdSchema,
    title: z.string().min(1),
    source: workItemSourceSchema,
    workflowId: workflowIdSchema.optional(),
    inputs: z.record(z.string(), z.string()).default({}),
    links: z.array(z.never()).default([]),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict()

export type WorkItem = z.infer<typeof workItemSchema>
export type WorkItemSource = z.infer<typeof workItemSourceSchema>

export const workItemSummarySchema = z.object({
  id: workItemIdSchema,
  title: z.string().min(1),
  source: workItemSourceSchema,
  workflowId: workflowIdSchema.optional(),
  updatedAt: z.string().min(1),
})

export type WorkItemSummary = z.infer<typeof workItemSummarySchema>

export const workItemDetailSchema = z.object({
  item: workItemSchema,
  hash: z.string().min(1),
})

export type WorkItemDetail = z.infer<typeof workItemDetailSchema>

export const createWorkItemBodySchema = z.object({
  title: z.string().min(1),
  workflowId: workflowIdSchema.optional(),
  inputs: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
  source: workItemSourceSchema.optional(),
})

export type CreateWorkItemBody = z.infer<typeof createWorkItemBodySchema>

export const putWorkItemBodySchema = z.object({
  title: z.string().min(1),
  workflowId: workflowIdSchema.optional(),
  inputs: z.record(z.string(), z.string()).default({}),
  baseHash: z.string().min(1),
})

export type PutWorkItemBody = z.infer<typeof putWorkItemBodySchema>

export const workItemConflictSchema = z.object({
  message: z.literal("conflict"),
  diskItem: workItemSchema,
  diskHash: z.string().min(1),
})

export type WorkItemConflict = z.infer<typeof workItemConflictSchema>

export const workItemNotesSchema = z.object({
  content: z.string(),
  hash: z.string().min(1),
})

export type WorkItemNotes = z.infer<typeof workItemNotesSchema>

export const putWorkItemNotesBodySchema = z.object({
  content: z.string(),
  baseHash: z.string().min(1).optional(),
})

export type PutWorkItemNotesBody = z.infer<typeof putWorkItemNotesBodySchema>

export const workItemNotesConflictSchema = z.object({
  message: z.literal("conflict"),
  diskContent: z.string(),
  diskHash: z.string().min(1),
})

export type WorkItemNotesConflict = z.infer<typeof workItemNotesConflictSchema>

/** Basename only; no path separators (BL-038). */
export const attachmentNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9._-]+$/, "attachment name must be a safe basename")

export const workItemAttachmentSchema = z.object({
  name: attachmentNameSchema,
  size: z.number().int().nonnegative(),
})

export type WorkItemAttachment = z.infer<typeof workItemAttachmentSchema>

export const workItemAttachmentListSchema = z.object({
  files: z.array(workItemAttachmentSchema),
})

export type WorkItemAttachmentList = z.infer<
  typeof workItemAttachmentListSchema
>

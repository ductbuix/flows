import { z } from "zod"
import { defineMethod, defineNotification } from "./define.ts"

const fcpRequestKeySchema = z.string().uuid().optional()
const DEFAULT_LIST_LIMIT_MAX = 500

/** Approval options today; later kinds add their own option ids (DES-041). */
export const inboxApprovalOptionIdSchema = z.enum(["approved", "rejected"])

/** ACP Cursor permission option ids (DES-041 / BL-146). */
export const inboxPermissionOptionIdSchema = z.enum([
  "allow-once",
  "allow-always",
  "reject-once",
])

export const inboxItemOptionIdSchema = z.union([
  inboxApprovalOptionIdSchema,
  inboxPermissionOptionIdSchema,
])

const inboxItemBase = {
  id: z.string().min(1),
  runId: z.string().min(1),
  workflowId: z.string().min(1).optional(),
  nodeId: z.string().min(1),
  pass: z.number().int().positive(),
  question: z.string(),
  at: z.string().min(1),
  status: z.enum(["open", "resolved"]),
}

export const inboxApprovalItemSchema = z.object({
  ...inboxItemBase,
  kind: z.literal("approval"),
  decision: inboxApprovalOptionIdSchema.optional(),
})

export const inboxPermissionItemSchema = z.object({
  ...inboxItemBase,
  kind: z.literal("permission"),
  tool: z.string().min(1),
  requestId: z.string().min(1),
  decision: inboxPermissionOptionIdSchema.optional(),
})

export const inboxItemSchema = z.discriminatedUnion("kind", [
  inboxApprovalItemSchema,
  inboxPermissionItemSchema,
])

export const inboxItemKindSchema = z.enum(["approval", "permission"])

export type WireInboxItem = z.infer<typeof inboxItemSchema>

export const inboxListParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(DEFAULT_LIST_LIMIT_MAX).optional(),
})

export const inboxListResultSchema = z.object({
  items: z.array(inboxItemSchema),
  next: z.string().min(1).optional(),
})

export const inboxListMethod = defineMethod({
  name: "inbox/list",
  params: inboxListParamsSchema,
  result: inboxListResultSchema,
  kind: "query",
})

export const inboxAnswerParamsSchema = z.object({
  itemId: z.string().min(1),
  optionId: z.string().min(1),
  requestKey: fcpRequestKeySchema,
})

export const inboxAnswerResultSchema = z.object({})

export const inboxAnswerMethod = defineMethod({
  name: "inbox/answer",
  params: inboxAnswerParamsSchema,
  result: inboxAnswerResultSchema,
  kind: "command",
})

export const inboxDismissParamsSchema = z.object({
  itemId: z.string().min(1),
  requestKey: fcpRequestKeySchema,
})

export const inboxDismissResultSchema = z.object({})

export const inboxDismissMethod = defineMethod({
  name: "inbox/dismiss",
  params: inboxDismissParamsSchema,
  result: inboxDismissResultSchema,
  kind: "command",
})

export const inboxUpdateNotification = defineNotification({
  name: "inbox/update",
  params: z.discriminatedUnion("kind", [
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("item_added"),
      item: inboxItemSchema,
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("item_resolved"),
      itemId: z.string().min(1),
      decision: inboxItemOptionIdSchema.optional(),
    }),
  ]),
})

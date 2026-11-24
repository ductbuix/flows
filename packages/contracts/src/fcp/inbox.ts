import { z } from "zod"
import { defineMethod, defineNotification } from "./define.ts"

const fcpRequestKeySchema = z.string().uuid().optional()
const DEFAULT_LIST_LIMIT_MAX = 500

/** Approval options today; later kinds add their own option ids (DES-041). */
export const inboxApprovalOptionIdSchema = z.enum(["approved", "rejected"])

export const inboxItemKindSchema = z.literal("approval")

export const inboxItemSchema = z.object({
  id: z.string().min(1),
  kind: inboxItemKindSchema,
  runId: z.string().min(1),
  workflowId: z.string().min(1).optional(),
  nodeId: z.string().min(1),
  pass: z.number().int().positive(),
  question: z.string(),
  at: z.string().min(1),
  status: z.enum(["open", "resolved"]),
  decision: inboxApprovalOptionIdSchema.optional(),
})

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
      decision: inboxApprovalOptionIdSchema.optional(),
    }),
  ]),
})

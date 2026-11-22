import { z } from "zod"

/** One in-app notice, posted by an Output `notify` step (BL-100). */
export const noticeSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  text: z.string(),
  runId: z.string(),
  workflowId: z.string(),
  nodeId: z.string(),
  at: z.string(),
  read: z.boolean(),
})
export type Notice = z.infer<typeof noticeSchema>

export const noticeListSchema = z.object({
  notices: z.array(noticeSchema),
  unread: z.number().int().nonnegative(),
})
export type NoticeList = z.infer<typeof noticeListSchema>

/** `ids` omitted marks every notice read. */
export const markNoticesReadBodySchema = z.object({
  ids: z.array(z.number().int().positive()).max(500).optional(),
})
export type MarkNoticesReadBody = z.infer<typeof markNoticesReadBodySchema>

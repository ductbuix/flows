import { z } from "zod"
import { defineNotification } from "./define.ts"

/** Where an Output notify step shows its notice (BL-100). */
export const noticeChannelSchema = z.enum(["app", "system"])

export type NoticeChannel = z.infer<typeof noticeChannelSchema>

/**
 * Engine → client: an Output notify step posted a notice. A desktop host
 * shows `channel: system` ones as system notifications.
 */
export const noticeUpdateNotification = defineNotification({
  name: "notice/update",
  params: z.object({
    seq: z.number().int().nonnegative(),
    kind: z.literal("notice_added"),
    notice: z.object({
      title: z.string(),
      text: z.string(),
      runId: z.string(),
      workflowId: z.string(),
      nodeId: z.string(),
      channel: noticeChannelSchema,
    }),
  }),
})

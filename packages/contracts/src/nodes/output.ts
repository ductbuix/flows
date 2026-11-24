import { z } from "zod"
import { connectionIdSchema } from "../ids.ts"
import { noticeChannelSchema } from "../fcp/notice.ts"
import { defineNodeKind } from "./define.ts"

/**
 * `folder` copies inputs to the run output; `publish` sends the work
 * copy's changes through a connection under its policy (DES-032, BL-084).
 * `notify` posts an in-app notice with `title` and the input text (BL-100);
 * `channel: system` also shows it as a system notification. The canvas
 * offers notify only; `folder` and `publish` stay for older workflows.
 */
export const outputKind = defineNodeKind({
  kind: "output",
  group: "flow",
  ports: { in: ["text", "file"], out: [] },
  settings: {
    target: z.enum(["folder", "publish", "notify"]),
    latest: z.boolean().optional(),
    /** Publish target: the connection whose work copy is sent. */
    connection: connectionIdSchema.optional(),
    /** Notify target: the notice title. */
    title: z.string().trim().min(1).max(120).optional(),
    /** Notify target: in the app only, or also a system notification. */
    channel: noticeChannelSchema.optional(),
  },
})

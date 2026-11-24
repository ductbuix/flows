import { z } from "zod"
import { connectionIdSchema } from "../ids.ts"
import { defineNodeKind } from "./define.ts"

/**
 * `folder` copies inputs to the run output; `publish` sends the work
 * copy's changes through a connection under its policy (DES-032, BL-084).
 * `notify` posts an in-app notice with `title` and the input text (BL-100).
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
  },
})

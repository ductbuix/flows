import { z } from "zod"
import { connectionIdSchema } from "../connection.ts"
import { defineNodeKind } from "./define.ts"

/**
 * `folder` copies inputs to the run output; `publish` sends the work
 * copy's changes through a connection under its policy (DES-032, BL-084).
 * `notify` comes later.
 */
export const outputKind = defineNodeKind({
  kind: "output",
  group: "flow",
  ports: { in: ["text", "file"], out: [] },
  settings: {
    target: z.enum(["folder", "publish"]),
    latest: z.boolean().optional(),
    /** Publish target: the connection whose work copy is sent. */
    connection: connectionIdSchema.optional(),
  },
})

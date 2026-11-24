import { z } from "zod"
import { connectionIdSchema } from "../ids.ts"
import { defineNodeKind } from "./define.ts"

/** One library resource an Asset lists: a connection's entity (DES-026). */
export const assetResourceSchema = z.strictObject({
  connection: connectionIdSchema,
  entity: z.string().min(1),
  id: z.string().min(1),
})

export type AssetResource = z.infer<typeof assetResourceSchema>

/**
 * Library resources as input (DES-032). No process: the run pins them at
 * start and the step emits the pinned folders. With `propose`, wired steps
 * work in the run's work copy and an Output `publish` can send the changes
 * (BL-084).
 */
export const assetKind = defineNodeKind({
  kind: "asset",
  group: "inputs",
  ports: { in: [], out: ["text", "file"] },
  settings: {
    resources: z.array(assetResourceSchema),
    access: z.enum(["read", "propose"]).default("read"),
  },
})

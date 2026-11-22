import { z } from "zod"
import { connectionIdSchema } from "../connection.ts"
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
 * start and the step emits the pinned folders. Read access only for now.
 */
export const assetKind = defineNodeKind({
  kind: "asset",
  group: "inputs",
  ports: { in: [], out: ["text", "file"] },
  settings: {
    resources: z.array(assetResourceSchema),
    access: z.literal("read").default("read"),
  },
})

import { z } from "zod"

export const healthSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  /** True when the server runs with FLOWS_NODES=1 (DES-037 Rollout). */
  nodes: z.boolean().optional(),
})

export type Health = z.infer<typeof healthSchema>

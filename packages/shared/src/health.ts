import { z } from "zod"

export const healthSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
})

export type Health = z.infer<typeof healthSchema>

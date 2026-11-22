import { z } from "zod"

/** `workflow.layout.json` (DES-033 Layout file): editor-only positions. */
export const layoutFileSchema = z.object({
  version: z.literal(1).default(1),
  nodes: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number() })
    .optional(),
})

export type LayoutFile = z.infer<typeof layoutFileSchema>

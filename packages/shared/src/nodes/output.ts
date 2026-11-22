import { z } from "zod"
import { defineNodeKind } from "./define.ts"

/** `folder` target only; publish and notify come later (DES-032). */
export const outputKind = defineNodeKind({
  kind: "output",
  group: "flow",
  ports: { in: ["text", "file"], out: [] },
  settings: {
    target: z.literal("folder"),
    latest: z.boolean().optional(),
  },
})

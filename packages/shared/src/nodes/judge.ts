import { z } from "zod"
import { effortSchema, modelIdSchema } from "../model-effort.ts"
import { stepSettings } from "./common.ts"
import { defineNodeKind } from "./define.ts"

/** Judge in rule mode: the CLI answers yes or no; the answer picks the branch (DES-032). */
export const judgeKind = defineNodeKind({
  kind: "judge",
  group: "flow",
  // Both branches forward what came in, so the out ports follow the in ports.
  ports: { in: ["text", "file"], out: ["text", "file"] },
  branches: ["yes", "no"],
  files: [{ path: "rule.md", required: true }],
  process: "cli",
  settings: {
    cli: z.enum(["claude", "cursor"]),
    model: modelIdSchema.optional(),
    effort: effortSchema.optional(),
    ...stepSettings,
  },
})

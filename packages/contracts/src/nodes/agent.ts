import { z } from "zod"
import { effortSchema, modelIdSchema } from "../model-effort.ts"
import { answersSchema, stepAllowLists, stepSettings } from "./common.ts"
import { defineNodeKind } from "./define.ts"

export const agentKind = defineNodeKind({
  kind: "agent",
  group: "steps",
  ports: { in: ["text", "file"], out: ["text", "file"] },
  files: [{ path: "prompt.md", required: true }],
  process: "cli",
  answers: true,
  settings: {
    cli: z.enum(["claude", "cursor"]),
    model: modelIdSchema.optional(),
    effort: effortSchema.optional(),
    memory: z.array(z.string().min(1)).optional(),
    answers: answersSchema.optional(),
    ...stepAllowLists,
    ...stepSettings,
  },
})

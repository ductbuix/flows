import { z } from "zod"
import { effortSchema, modelIdSchema } from "../model-effort.ts"
import { answersSchema, stepSettings } from "./common.ts"
import { defineNodeKind } from "./define.ts"

/** One model call through a CLI in print mode, no tools; stdout is the text (DES-032). */
export const llmKind = defineNodeKind({
  kind: "llm",
  group: "steps",
  ports: { in: ["text", "file"], out: ["text"] },
  files: [
    { path: "prompt.md", required: true },
    { path: "system.md", required: false },
  ],
  process: "cli",
  answers: true,
  settings: {
    cli: z.enum(["claude", "cursor"]),
    model: modelIdSchema.optional(),
    effort: effortSchema.optional(),
    answers: answersSchema.optional(),
    /** Cursor create_plan: auto-accept or Inbox review (DES-041 / BL-148). */
    planReview: z.enum(["auto", "ask"]).optional(),
    /** Skill slugs this step may use (mock parity / BL-206). */
    skills: z.array(z.string().min(1)).optional(),
    ...stepSettings,
  },
})

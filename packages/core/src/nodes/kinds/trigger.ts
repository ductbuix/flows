import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent } from "../types.ts"

const settings = z.object({
  type: z.literal("manual"),
  inputs: z.array(z.unknown()).optional(),
})

type Settings = z.infer<typeof settings>

/**
 * Trigger: run input text and files become the step output (DES-034 / DES-041).
 */
export const triggerKind = defineNodeKind({
  kind: "trigger",
  settings,
  ports: { in: [], out: ["text", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const textInput = ctx.inputs.find((i) => i.name === "text.md")
    const text = textInput?.text ?? ""
    yield {
      kind: "output_written",
      path: await ctx.outputs.write("text.md", text),
    }

    for (const input of ctx.inputs) {
      if (input.name === "text.md") continue
      const rel = input.name.startsWith("files/")
        ? input.name
        : `files/${input.name}`
      const body = input.text ?? ""
      yield {
        kind: "output_written",
        path: await ctx.outputs.write(rel, body),
      }
    }
    yield { kind: "done" }
  },
})

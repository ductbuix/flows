import { evaluateCheck, judgeCheckSchema } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent, StepInput } from "../types.ts"

const settings = z.object({
  mode: z.literal("check"),
  check: judgeCheckSchema,
})

type Settings = z.infer<typeof settings>

function joinedText(inputs: readonly StepInput[]): string {
  const parts: string[] = []
  for (const i of inputs) {
    if (i.name !== "text.md" || i.text === undefined) continue
    parts.push(`## ${i.from}\n\n${i.text.trimEnd()}\n`)
  }
  return parts.join("\n")
}

async function* forwardInputs(
  ctx: StepContext<Settings>
): AsyncIterable<StepEvent> {
  yield {
    kind: "output_written",
    path: await ctx.outputs.write("text.md", joinedText(ctx.inputs)),
  }
  for (const input of ctx.inputs) {
    if (input.name === "text.md") continue
    const rel = input.name.startsWith("files/")
      ? input.name
      : `files/${input.name}`
    yield {
      kind: "output_written",
      path: await ctx.outputs.write(rel, input.text ?? ""),
    }
  }
}

/**
 * Judge check mode (DES-032 / BL-101): test a named answer with no model
 * call. Registered as `judge`; rule mode routes to `condition` instead.
 */
export const judgeCheckKind = defineNodeKind({
  kind: "judge",
  settings,
  ports: { in: ["text", "file"], out: ["text", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const { check } = ctx.settings
    const passed = evaluateCheck(check, ctx.answers[check.field])
    yield* forwardInputs(ctx)
    yield { kind: "done", branch: passed ? "yes" : "no" }
  },
})

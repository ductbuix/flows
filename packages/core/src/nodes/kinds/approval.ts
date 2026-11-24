import { fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent, StepInput } from "../types.ts"

const settings = z.object({
  question: z.string().min(1),
})

type Settings = z.infer<typeof settings>

/** Join active text inputs in edge order (engine `joinedInputText`). */
function joinedText(
  inputs: readonly StepInput[],
  nameOf: (id: string) => string
): string {
  const byFrom = new Map<string, string>()
  for (const i of inputs) {
    if (i.name !== "text.md" || i.text === undefined) continue
    byFrom.set(i.from, i.text)
  }
  const parts: string[] = []
  for (const [from, text] of byFrom) {
    parts.push(`## ${nameOf(from)}\n\n${text.trimEnd()}\n`)
  }
  return parts.join("\n")
}

async function* forward(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
  const text = joinedText(ctx.inputs, (id) => id)
  yield {
    kind: "output_written",
    path: await ctx.outputs.write("text.md", text),
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
  yield { kind: "done" }
}

/**
 * Approval: ask via inbox, then forward inputs on approve (DES-032 / DES-041).
 * Reject is handled by the actor (`answer` → `step_rejected`); execute is not
 * re-entered after a reject.
 */
export const approvalKind = defineNodeKind({
  kind: "approval",
  settings,
  ports: { in: ["text", "file"], out: ["text", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    if (ctx.decision === "approved") {
      yield* forward(ctx)
      return
    }
    const question = fillTemplate(ctx.settings.question, ctx.answers)
    const decision = await ctx.inbox.ask(question)
    if (decision === "approved") {
      yield* forward(ctx)
      return
    }
    yield { kind: "waiting", question }
  },
})

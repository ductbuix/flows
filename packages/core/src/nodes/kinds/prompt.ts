import { fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent } from "../types.ts"

const settings = z.object({
  /** Inline text for tests; otherwise read frozen text.md. */
  text: z.string().optional(),
})

type Settings = z.infer<typeof settings>

function readFrozen(
  ctx: StepContext<Settings>,
  name: string
): string | undefined {
  const path = `${ctx.runDir}/nodes/${ctx.node.id}/frozen/${name}`
  return ctx.docs.read(path)?.text
}

/**
 * Prompt: write filled frozen `text.md` as the step output (DES-034).
 */
export const promptKind = defineNodeKind({
  kind: "prompt",
  settings,
  ports: { in: [], out: ["text"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const raw = ctx.settings.text ?? readFrozen(ctx, "text.md") ?? ""
    const text = fillTemplate(raw, ctx.answers)
    yield {
      kind: "output_written",
      path: await ctx.outputs.write("text.md", text),
    }
    yield { kind: "done" }
  },
})

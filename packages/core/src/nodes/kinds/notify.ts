import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent, StepInput } from "../types.ts"

const settings = z.object({
  target: z.literal("notify"),
  title: z.string().trim().min(1).max(120).optional(),
  channel: z.enum(["app", "system"]).optional(),
  name: z.string().optional(),
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

/**
 * Output notify: posts an in-app notice with title and input text (BL-100);
 * `channel: system` also asks the host for a system notification.
 * Registered as kind `notify`; YAML remains `output` + `target: notify`.
 */
export const notifyKind = defineNodeKind({
  kind: "notify",
  settings,
  ports: { in: ["text", "file"], out: [] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const title =
      ctx.settings.title ??
      ctx.settings.name ??
      ctx.node.name ??
      ctx.graph.name ??
      ctx.graph.id
    const text = joinedText(ctx.inputs).trim()
    const { channel } = ctx.settings
    yield { kind: "notify", title, text, ...(channel ? { channel } : {}) }
    yield { kind: "done", outputs: [] }
  },
})

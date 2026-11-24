import { fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import type { ContentBlock } from "../../ports/agent-runtime.ts"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent, StepInput } from "../types.ts"

const settings = z.object({
  cli: z.enum(["claude", "cursor"]).default("cursor"),
  model: z.string().optional(),
  effort: z.string().optional(),
  /** Inline prompt for tests; otherwise read frozen prompt.md. */
  prompt: z.string().optional(),
  system: z.string().optional(),
})

type Settings = z.infer<typeof settings>

/** Profile id for the ACP session (Cursor first; BL-140). */
export function llmProfileId(cli: "claude" | "cursor"): string {
  return cli === "cursor" ? "cursor" : "cursor"
}

/** Prompt text: optional system, then prompt (DES-032 / DES-041). */
export function llmPromptText(parts: {
  system?: string
  prompt: string
}): string {
  const out: string[] = []
  const system = parts.system?.trim()
  if (system) out.push(system)
  out.push(parts.prompt.trim())
  return `${out.join("\n\n")}\n`
}

/** Text plus one resource block per input file (DES-041). */
export function llmContentBlocks(
  promptText: string,
  inputs: readonly StepInput[]
): ContentBlock[] {
  const blocks: ContentBlock[] = [{ type: "text", text: promptText }]
  for (const input of inputs) {
    blocks.push({
      type: "resource",
      uri: `file://${input.name}`,
      mimeType: "text/plain",
      text: input.text ?? "",
    })
  }
  return blocks
}

function readFrozen(
  ctx: StepContext<Settings>,
  name: string
): string | undefined {
  const path = `${ctx.runDir}/nodes/${ctx.node.id}/frozen/${name}`
  return ctx.docs.read(path)?.text
}

/**
 * LLM over ACP in agent mode (DES-041 / BL-142). Prompt plus input files
 * as resource blocks; message text becomes the step output.
 */
export const llmKind = defineNodeKind({
  kind: "llm",
  settings,
  ports: { in: ["text", "file"], out: ["text"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const promptRaw = ctx.settings.prompt ?? readFrozen(ctx, "prompt.md") ?? ""
    if (!promptRaw.trim()) {
      yield { kind: "failed", reason: "exit", message: "missing_prompt" }
      return
    }
    const systemRaw = ctx.settings.system ?? readFrozen(ctx, "system.md")
    const promptText = llmPromptText({
      system: systemRaw ? fillTemplate(systemRaw, ctx.answers) : undefined,
      prompt: fillTemplate(promptRaw, ctx.answers),
    })
    const blocks = llmContentBlocks(promptText, ctx.inputs)
    const session = await ctx.agent.session({
      profileId: llmProfileId(ctx.settings.cli),
      // Host fills absolute cwd via createStepContext agentCwd (DES-041).
      cwd: "",
      mode: "agent",
      ...(ctx.settings.model !== undefined
        ? { model: ctx.settings.model }
        : {}),
      ...(ctx.settings.effort !== undefined
        ? { effort: ctx.settings.effort }
        : {}),
    })
    let text = ""
    try {
      if (session.setMode) await session.setMode("agent")
      for await (const event of session.prompt(blocks, ctx.signal)) {
        if (event.kind === "message_chunk") text += event.text
        if (event.kind === "stop" && event.reason === "cancelled") {
          yield { kind: "failed", reason: "exit", message: "cancelled" }
          return
        }
        if (event.kind === "stop" && event.reason === "refusal") {
          yield { kind: "failed", reason: "exit", message: "refusal" }
          return
        }
      }
    } finally {
      await session.close()
    }
    yield {
      kind: "output_written",
      path: await ctx.outputs.write("text.md", text.trim()),
    }
    yield { kind: "done" }
  },
})

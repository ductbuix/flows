import { fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent } from "../types.ts"
import {
  llmContentBlocks,
  llmPromptText,
  llmProfileId,
} from "../agent-prompt.ts"
import { createReply, logNarration } from "../agent-reply.ts"
import { logPrompt, logToolEvent, type ToolMap } from "../tool-log.ts"

const settings = z.object({
  cli: z.enum(["claude", "cursor"]).default("cursor"),
  model: z.string().optional(),
  effort: z.string().optional(),
  /** Cursor create_plan: auto-accept or Inbox review (default auto). */
  planReview: z.enum(["auto", "ask"]).optional(),
  /** Inline prompt for tests; otherwise read frozen prompt.md. */
  prompt: z.string().optional(),
  system: z.string().optional(),
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
 * LLM over ACP in agent mode (DES-041 / BL-142). Prompt plus upstream
 * results as resource blocks; the agent's last message is the result.
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
    const blocks = llmContentBlocks(promptText, ctx.inputs, ctx.node.id)
    logPrompt(ctx, ctx.settings, "agent", promptText)
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
    const reply = createReply(logNarration(ctx))
    const tools: ToolMap = new Map()
    try {
      if (session.setMode) await session.setMode("agent")
      for await (const event of session.prompt(blocks, ctx.signal)) {
        reply.push(event)
        logToolEvent(ctx, tools, event)
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
    const text = reply.final()
    ctx.log({ kind: "message", title: "Agent reply", text })
    yield {
      kind: "output_written",
      path: await ctx.outputs.write("text.md", text),
    }
    yield { kind: "done" }
  },
})

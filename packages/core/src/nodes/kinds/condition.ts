import { fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent } from "../types.ts"
import {
  createReply,
  llmContentBlocks,
  logNarration,
  llmProfileId,
  llmPromptText,
  logPrompt,
  logToolEvent,
} from "./llm.ts"

/** Named branches on a condition node (DES-041 / mockup). */
export const CONDITION_BRANCHES = ["yes", "no"] as const

export type ConditionBranch = (typeof CONDITION_BRANCHES)[number]

const settings = z.object({
  cli: z.enum(["claude", "cursor"]).default("cursor"),
  model: z.string().optional(),
  effort: z.string().optional(),
  /** Inline prompt for tests; otherwise read frozen prompt.md or rule.md. */
  prompt: z.string().optional(),
  system: z.string().optional(),
})

type Settings = z.infer<typeof settings>

/**
 * First word of the agent answer mapped to a branch name (DES-032 /
 * DES-041). `true`/`false` alias yes/no; anything else is unclear.
 */
export function conditionBranch(
  text: string,
  branches: readonly string[] = CONDITION_BRANCHES
): string | undefined {
  const word = /[a-z]+/i.exec(text)?.[0]?.toLowerCase()
  if (!word) return undefined
  const normalized = word === "true" ? "yes" : word === "false" ? "no" : word
  return branches.includes(normalized) ? normalized : undefined
}

function readFrozen(
  ctx: StepContext<Settings>,
  name: string
): string | undefined {
  const path = `${ctx.runDir}/nodes/${ctx.node.id}/frozen/${name}`
  return ctx.docs.read(path)?.text
}

function resolvePrompt(ctx: StepContext<Settings>): string | undefined {
  const raw =
    ctx.settings.prompt ??
    readFrozen(ctx, "prompt.md") ??
    readFrozen(ctx, "rule.md")
  return raw?.trim() ? raw : undefined
}

/**
 * Condition over ACP in ask mode (DES-041 / BL-143). The verdict is the
 * step result (`text.md`) and its first word picks a named branch;
 * unparsable fails with reason unclear. Inputs are not copied: nodes
 * after a judge read the gated results by reference (DES-034).
 */
export const conditionKind = defineNodeKind({
  kind: "condition",
  settings,
  ports: { in: ["text", "file"], out: ["text", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const promptRaw = resolvePrompt(ctx)
    if (!promptRaw) {
      yield { kind: "failed", reason: "exit", message: "missing_prompt" }
      return
    }
    const systemRaw = ctx.settings.system ?? readFrozen(ctx, "system.md")
    const promptText = llmPromptText({
      system: systemRaw ? fillTemplate(systemRaw, ctx.answers) : undefined,
      prompt: fillTemplate(promptRaw, ctx.answers),
    })
    const blocks = llmContentBlocks(promptText, ctx.inputs, ctx.node.id)
    logPrompt(ctx, ctx.settings, "ask", promptText)
    const session = await ctx.agent.session({
      profileId: llmProfileId(ctx.settings.cli),
      cwd: "",
      mode: "ask",
      ...(ctx.settings.model !== undefined
        ? { model: ctx.settings.model }
        : {}),
      ...(ctx.settings.effort !== undefined
        ? { effort: ctx.settings.effort }
        : {}),
    })
    const reply = createReply(logNarration(ctx))
    const tools = new Map<string, { title?: string; input?: unknown }>()
    try {
      if (session.setMode) await session.setMode("ask")
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
    const answer = reply.final()
    yield {
      kind: "output_written",
      path: await ctx.outputs.write("text.md", answer),
    }
    const branch = conditionBranch(answer)
    ctx.log({
      kind: "message",
      title: branch ? `Judge answered ${branch}` : "Judge answer unclear",
      status: branch ? "ok" : "failed",
      text: answer,
    })
    if (!branch) {
      yield {
        kind: "failed",
        reason: "unclear",
        message: answer || "unclear_answer",
      }
      return
    }
    yield { kind: "done", branch }
  },
})

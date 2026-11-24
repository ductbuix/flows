import { fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent, StepInput } from "../types.ts"
import {
  llmContentBlocks,
  llmProfileId,
  llmPromptText,
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

async function* keepAnswer(
  ctx: StepContext<Settings>,
  text: string
): AsyncIterable<StepEvent> {
  yield {
    kind: "output_written",
    path: await ctx.outputs.write("answer.md", text),
  }
}

function joinedText(inputs: readonly StepInput[]): string {
  const byFrom = new Map<string, string>()
  for (const i of inputs) {
    if (i.name !== "text.md" || i.text === undefined) continue
    byFrom.set(i.from, i.text)
  }
  const parts: string[] = []
  for (const [from, body] of byFrom) {
    parts.push(`## ${from}\n\n${body.trimEnd()}\n`)
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

function resolvePrompt(ctx: StepContext<Settings>): string | undefined {
  const raw =
    ctx.settings.prompt ??
    readFrozen(ctx, "prompt.md") ??
    readFrozen(ctx, "rule.md")
  return raw?.trim() ? raw : undefined
}

/**
 * Condition over ACP in ask mode (DES-041 / BL-143). Answer's first word
 * picks a named branch; unparsable fails with reason unclear and keeps text.
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
    const blocks = llmContentBlocks(promptText, ctx.inputs)
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
    let text = ""
    const tools = new Map<string, { title?: string; input?: unknown }>()
    try {
      if (session.setMode) await session.setMode("ask")
      for await (const event of session.prompt(blocks, ctx.signal)) {
        if (event.kind === "message_chunk") text += event.text
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
    const answer = text.trim()
    ctx.log({ kind: "message", title: "Judge reply", text: answer })
    yield* keepAnswer(ctx, answer)
    const branch = conditionBranch(answer)
    if (!branch) {
      yield {
        kind: "failed",
        reason: "unclear",
        message: answer || "unclear_answer",
      }
      return
    }
    yield* forwardInputs(ctx)
    yield { kind: "done", branch }
  },
})

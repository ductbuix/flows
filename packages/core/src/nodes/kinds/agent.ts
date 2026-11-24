import { answersSchema, fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import {
  agentAnswerPrompt,
  agentFixPrompt,
  ANSWER_ERROR_FILE,
  nodeAnswerDecls,
  readStepAnswer,
  settleAnswer,
} from "../agent-answer.ts"
import { copyAgentMemories } from "../agent-memory.ts"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent } from "../types.ts"
import { llmContentBlocks, llmProfileId, llmPromptText } from "./llm.ts"

const settings = z.object({
  cli: z.enum(["claude", "cursor"]).default("cursor"),
  model: z.string().optional(),
  effort: z.string().optional(),
  memory: z.array(z.string().min(1)).optional(),
  answers: answersSchema.optional(),
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
 * Agent over ACP (DES-041 / BL-195). Memory paths and answer settle use
 * DocumentStore; CLI shell settle lived in the engine and is mirrored here.
 */
export const agentKind = defineNodeKind({
  kind: "agent",
  settings,
  ports: { in: ["text", "file"], out: ["text", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const promptRaw = ctx.settings.prompt ?? readFrozen(ctx, "prompt.md") ?? ""
    if (!promptRaw.trim()) {
      yield { kind: "failed", reason: "exit", message: "missing_prompt" }
      return
    }

    const decls = nodeAnswerDecls({
      id: ctx.node.id,
      kind: "agent",
      answers: ctx.settings.answers,
    })
    const workflowDir = ctx.runDir.replace(/\/runs\/[^/]+$/, "")
    copyAgentMemories(ctx.docs, workflowDir, ctx.stepDir, ctx.settings.memory)

    const systemRaw = ctx.settings.system ?? readFrozen(ctx, "system.md")
    const parts = [
      llmPromptText({
        system: systemRaw ? fillTemplate(systemRaw, ctx.answers) : undefined,
        prompt: fillTemplate(promptRaw, ctx.answers),
      }).trimEnd(),
    ]
    if (decls.length > 0) parts.push(agentAnswerPrompt(decls))
    const priorError = ctx.docs.read(
      `${ctx.stepDir}/${ANSWER_ERROR_FILE}`
    )?.text
    if (priorError) parts.push(agentFixPrompt(priorError))

    const blocks = llmContentBlocks(`${parts.join("\n\n")}\n`, ctx.inputs)
    const session = await ctx.agent.session({
      profileId: llmProfileId(ctx.settings.cli),
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

    if (decls.length > 0) {
      const found = readStepAnswer(ctx.docs, ctx.stepDir, decls)
      const settled = settleAnswer(ctx.docs, ctx.stepDir, decls, found)
      if (!settled.ok && "reason" in settled) {
        yield { kind: "failed", reason: "answer" }
        return
      }
      if (!settled.ok && settled.fix) {
        yield { kind: "failed", reason: "answer", message: "fix" }
        return
      }
      if (settled.ok) {
        yield {
          kind: "output_written",
          path: await ctx.outputs.write("text.md", text.trim()),
        }
        yield { kind: "done", answer: settled.answer }
        return
      }
    }

    yield {
      kind: "output_written",
      path: await ctx.outputs.write("text.md", text.trim()),
    }
    yield { kind: "done" }
  },
})

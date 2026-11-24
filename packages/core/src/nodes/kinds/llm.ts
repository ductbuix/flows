import { fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import type { AgentEvent, ContentBlock } from "../../ports/agent-runtime.ts"
import { defineNodeKind } from "../define.ts"
import type { LogEntry } from "../attempt-log.ts"
import type { StepContext, StepEvent, StepInput } from "../types.ts"

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

/** Store-free uri naming an input by the node that produced it. */
export function inputUri(input: Pick<StepInput, "from" | "name">): string {
  return input.from === "input"
    ? `flows://input/${input.name}`
    : `flows://nodes/${input.from}/${input.name}`
}

function inputLabel(input: StepInput, selfId?: string): string {
  if (input.from === "input") return "run input"
  if (input.role === "feedback") return `feedback from judge ${input.from}`
  if (input.from === selfId) return "your previous result"
  return `result of node ${input.from}`
}

/**
 * Prompt text, a list of the inputs, then one resource block per input
 * (DES-041). Inputs are upstream results only, attached here rather
 * than placed in the agent's working directory.
 */
export function llmContentBlocks(
  promptText: string,
  inputs: readonly StepInput[],
  selfId?: string
): ContentBlock[] {
  const blocks: ContentBlock[] = [{ type: "text", text: promptText }]
  const attached = inputs.filter((i) => i.text?.trim())
  if (attached.length === 0) return blocks
  const lines = attached.map(
    (i) => `- ${inputUri(i)}: ${inputLabel(i, selfId)}`
  )
  blocks.push({
    type: "text",
    text: `Inputs (attached below; they are not files in your working directory):\n${lines.join("\n")}\n`,
  })
  for (const input of attached) {
    blocks.push({
      type: "resource",
      uri: inputUri(input),
      mimeType: input.name.endsWith(".md") ? "text/markdown" : "text/plain",
      text: input.text ?? "",
    })
  }
  return blocks
}

/**
 * The agent's reply split at tool calls. The step result is the last
 * message it sent (after its last tool call); earlier messages are
 * narration and only go to the attempt log.
 */
export function createReply(logNarration?: (text: string) => void): {
  push(event: AgentEvent): void
  final(): string
} {
  let current = ""
  let previous = ""
  return {
    push(event) {
      if (event.kind === "message_chunk") {
        current += event.text
        return
      }
      if (event.kind !== "tool_call" || !current.trim()) return
      logNarration?.(current.trim())
      previous = current
      current = ""
    },
    final() {
      return (current.trim() ? current : previous).trim()
    },
  }
}

/** Log one narration message an agent sent between tool calls. */
export function logNarration(ctx: {
  log(entry: Omit<LogEntry, "at">): void
}): (text: string) => void {
  return (text) => ctx.log({ kind: "message", title: "Agent message", text })
}

/** Shell line from a tool input like `{ command: "ls" }`. */
export function commandOf(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined
  const c = (input as { command?: unknown }).command
  if (typeof c === "string") return c
  return Array.isArray(c) ? c.join(" ") : undefined
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    const parts = content.map((item) => {
      const inner = (item as { content?: { text?: unknown } } | null)?.content
      if (typeof inner?.text === "string") return inner.text
      const direct = (item as { text?: unknown } | null)?.text
      return typeof direct === "string" ? direct : contentText(item)
    })
    return parts.join("\n")
  }
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return String(content)
  }
}

type ToolMap = Map<
  string,
  { title?: string; input?: unknown; output?: unknown; content?: unknown }
>

/** Log what was asked of the agent: the CLI, model and prompt text. */
export function logPrompt(
  ctx: { log(entry: Omit<LogEntry, "at">): void },
  settings: { cli: string; model?: string; effort?: string },
  mode: string,
  promptText: string
): void {
  const how = [settings.cli, settings.model, settings.effort, `${mode} mode`]
    .filter(Boolean)
    .join(" · ")
  ctx.log({
    kind: "command",
    title: `Prompt (${how})`,
    command: how,
    text: promptText.trim(),
  })
}

/** Shell result text: stdout, stderr and a non-zero exit code. */
function outputText(output: unknown): string {
  if (!output || typeof output !== "object") return contentText(output)
  const o = output as Record<string, unknown>
  const code = o.exitCode ?? o.exit_code
  const parts = [o.stdout, o.stderr, o.output]
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .map((p) => p.trimEnd())
  if (typeof code === "number" && code !== 0) parts.push(`exit ${code}`)
  return parts.length > 0 ? parts.join("\n") : contentText(output)
}

/** Log a tool call to the attempt when it settles, or on first sight. */
export function logToolEvent(
  ctx: { log(entry: Omit<LogEntry, "at">): void },
  tools: ToolMap,
  event: AgentEvent
): void {
  if (event.kind !== "tool_call" && event.kind !== "tool_call_update") return
  const prev = tools.get(event.id)
  const next = {
    title: event.kind === "tool_call" ? event.title : prev?.title,
    input: event.input ?? prev?.input,
    output:
      (event.kind === "tool_call_update" ? event.output : undefined) ??
      prev?.output,
    content:
      (event.kind === "tool_call_update" ? event.content : undefined) ??
      prev?.content,
  }
  tools.set(event.id, next)
  const settled = event.status === "completed" || event.status === "failed"
  if (!settled && !(event.kind === "tool_call" && !prev)) return
  const command = commandOf(next.input)
  const text =
    next.output !== undefined
      ? outputText(next.output)
      : next.content !== undefined
        ? contentText(next.content)
        : undefined
  ctx.log({
    id: event.id,
    kind: "tool_call",
    title: next.title ?? "Tool call",
    ...(command ? { command } : {}),
    status: event.status,
    ...(text?.trim() ? { text } : {}),
  })
}

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

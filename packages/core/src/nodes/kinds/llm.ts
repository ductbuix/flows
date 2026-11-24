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

/** Text plus one resource block per input file (DES-041). */
export function llmContentBlocks(
  promptText: string,
  inputs: readonly StepInput[]
): ContentBlock[] {
  const blocks: ContentBlock[] = [{ type: "text", text: promptText }]
  for (const input of inputs) {
    if (!input.text?.trim()) continue
    blocks.push({
      type: "resource",
      uri: `file://${input.name}`,
      mimeType: "text/plain",
      text: input.text ?? "",
    })
  }
  return blocks
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

type ToolMap = Map<string, { title?: string; input?: unknown }>

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
  }
  tools.set(event.id, next)
  const settled = event.status === "completed" || event.status === "failed"
  if (!settled && !(event.kind === "tool_call" && !prev)) return
  const command = commandOf(next.input)
  ctx.log({
    kind: "tool_call",
    title: next.title ?? "Tool call",
    ...(command ? { command } : {}),
    status: event.status,
    ...(event.kind === "tool_call_update" && event.content !== undefined
      ? { text: contentText(event.content) }
      : {}),
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
    const tools: ToolMap = new Map()
    try {
      if (session.setMode) await session.setMode("agent")
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
    ctx.log({ kind: "message", title: "Agent reply", text: text.trim() })
    yield {
      kind: "output_written",
      path: await ctx.outputs.write("text.md", text.trim()),
    }
    yield { kind: "done" }
  },
})

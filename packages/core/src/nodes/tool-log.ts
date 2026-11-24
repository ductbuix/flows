import type { AgentEvent } from "../ports/agent-runtime.ts"
import type { LogEntry } from "./attempt-log.ts"

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

export type ToolMap = Map<
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

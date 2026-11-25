import type { AgentEvent } from "../ports/agent-runtime.ts"
import type { LogEntry } from "./attempt-log.ts"

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

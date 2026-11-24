import type { AgentEvent } from "../ports/agent-runtime.ts"

/** Params published to UpdateBus (seq stamped by the bus). */
export type AgentRunUpdate = {
  kind: string
  runId: string
  stepId: string
  [key: string]: unknown
}

export type AgentUpdateContext = {
  runId: string
  stepId: string
}

/** Chunk kinds merged per run per 50 ms (DES-040). */
export const COALESCE_CHUNK_KINDS = new Set([
  "agent_message_chunk",
  "agent_thought_chunk",
])

/**
 * Map one `AgentEvent` to a `run/update` payload (DES-040 / DES-041).
 * `stop` returns null — it ends the prompt, not a stream update.
 */
export function mapAgentEventToRunUpdate(
  event: AgentEvent,
  ctx: AgentUpdateContext
): AgentRunUpdate | null {
  const { runId, stepId } = ctx
  switch (event.kind) {
    case "message_chunk":
      return { kind: "agent_message_chunk", runId, stepId, text: event.text }
    case "thought_chunk":
      return { kind: "agent_thought_chunk", runId, stepId, text: event.text }
    case "tool_call":
      return {
        kind: "tool_call",
        runId,
        stepId,
        id: event.id,
        title: event.title,
        toolKind: event.toolKind,
        status: event.status,
      }
    case "tool_call_update": {
      const update: AgentRunUpdate = {
        kind: "tool_call_update",
        runId,
        stepId,
        id: event.id,
        status: event.status,
      }
      if (event.content !== undefined) update.content = event.content
      return update
    }
    case "plan":
      return { kind: "plan", runId, stepId, entries: event.entries }
    case "todos":
      return { kind: "todos", runId, stepId, entries: event.entries }
    case "usage": {
      const update: AgentRunUpdate = {
        kind: "usage",
        runId,
        stepId,
        used: event.used,
        size: event.size,
      }
      if (event.cost) update.cost = event.cost
      return update
    }
    case "stop":
      return null
  }
}

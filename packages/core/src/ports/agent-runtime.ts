/**
 * AgentRuntime port (DES-041). Implemented by packages/agent-acp over ACP.
 */

/** Text or resource content sent in a prompt (ACP ContentBlock subset). */
export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "resource"
      uri: string
      mimeType?: string
      text?: string
    }
  | {
      type: "resource_link"
      uri: string
      name?: string
      mimeType?: string
    }

/** One plan / todo row from a session update. */
export type PlanEntry = {
  content: string
  status?: string
  priority?: string
}

/** Optional cost on a usage update. */
export type Money = {
  amount: number
  currency: string
}

/** What to open when starting an agent session. */
export type SessionSpec = {
  profileId: string
  cwd: string
  mode?: string
  model?: string
  effort?: string
  mcpServers?: readonly unknown[]
  skills?: readonly string[]
}

/** Listed by `AgentRuntime.profiles()`. */
export type AgentProfileInfo = {
  id: string
  modes?: readonly string[]
}

/**
 * Streamed session events. `session/update` notifications map 1:1
 * (DES-041); stop ends the prompt iterable.
 */
export type AgentEvent =
  | { kind: "message_chunk" | "thought_chunk"; text: string }
  | {
      kind: "tool_call"
      id: string
      title: string
      toolKind: string
      status: string
    }
  | { kind: "tool_call_update"; id: string; status: string; content?: unknown }
  | { kind: "plan" | "todos"; entries: PlanEntry[] }
  | { kind: "usage"; used: number; size: number; cost?: Money }
  | {
      kind: "stop"
      reason:
        | "end_turn"
        | "max_tokens"
        | "max_turn_requests"
        | "refusal"
        | "cancelled"
    }

/** One ACP conversation for a step. */
export interface AgentSession {
  readonly id: string
  prompt(
    blocks: readonly ContentBlock[],
    signal: AbortSignal
  ): AsyncIterable<AgentEvent>
  setMode?(mode: string): Promise<void>
  close(): Promise<void>
}

/** Spawns and drives agent CLIs behind one port (DES-041). */
export interface AgentRuntime {
  profiles(): readonly AgentProfileInfo[]
  open(spec: SessionSpec, signal: AbortSignal): Promise<AgentSession>
}

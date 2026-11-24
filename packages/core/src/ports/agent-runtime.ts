import type { Skill } from "../skills/catalog.ts"

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

/** One plan row from a session update. */
export type PlanEntry = {
  content: string
  status?: string
  priority?: string
}

/** One todo row from `cursor/update_todos` (id required for merge). */
export type TodoEntry = {
  id: string
  content: string
  status: string
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
  /** Selected skills for the step; profile places them under the work dir. */
  skills?: readonly Skill[]
  /**
   * Park ACP client requests as Inbox items until answered (BL-192).
   * Without these, requests wait for `session/cancel` → `cancelled`.
   */
  handlePermission?: (params: unknown) => Promise<unknown>
  handleAskQuestion?: (params: unknown) => Promise<unknown>
  handleCreatePlan?: (params: unknown) => Promise<unknown>
}

/** Listed by `AgentRuntime.profiles()` / `list()` (FCP `agent/list`). */
export type AgentProfileInfo = {
  id: string
  modes?: readonly string[]
  /** Set by `list()` after probing PATH. */
  found?: boolean
  /** First line of `--version` when found. */
  version?: string | null
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
      /** Raw tool input (e.g. `{ command }` for a shell tool). */
      input?: unknown
    }
  | {
      kind: "tool_call_update"
      id: string
      status: string
      content?: unknown
      input?: unknown
    }
  | { kind: "plan"; entries: PlanEntry[] }
  | { kind: "todos"; entries: TodoEntry[] }
  | {
      kind: "subagent"
      id: string
      description: string
      subagentType: string
      durationMs?: number
    }
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
  /** Probe PATH for each profile (FCP `agent/list`). */
  list(signal?: AbortSignal): Promise<readonly AgentProfileInfo[]>
  open(spec: SessionSpec, signal: AbortSignal): Promise<AgentSession>
}

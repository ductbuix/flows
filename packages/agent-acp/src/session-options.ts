import type { Logger } from "@workspace/core"

/** `undefined` keeps Cursor handlers; empty/false skips (generic, BL-150). */
export function extensionEnabled(
  extensions: Readonly<Record<string, unknown>> | undefined,
  method: string
): boolean {
  if (extensions === undefined) return true
  return Boolean(extensions[method])
}

/** Client capabilities advertised on `initialize` (DES-041). */
export const ACP_CLIENT_CAPABILITIES = {
  fs: { readTextFile: true, writeTextFile: true },
  terminal: false,
} as const

export type OpenAcpSessionOptions = {
  cwd: string
  /**
   * Absolute roots for `fs/*` (default: `[cwd]`). Paths outside these
   * roots are rejected (DES-041 path policy).
   */
  allowedRoots?: readonly string[]
  mcpServers?: readonly unknown[]
  logger?: Logger
  signal?: AbortSignal
  clientInfo?: { name: string; version: string }
  protocolVersion?: number
  /** When set and listed in initialize authMethods, call authenticate. */
  authMethod?: string
  /** Wait after `session/cancel` before `kill` (default 5s). */
  cancelGraceMs?: number
  /** End the agent process group if it ignores `session/cancel`. */
  kill?: () => void
  /**
   * When the chain says ask (or host decides), resolve
   * `session/request_permission` (BL-146). Without this, requests park
   * until `session/cancel` answers `cancelled`.
   */
  handlePermission?: (params: unknown) => Promise<unknown>
  /**
   * Resolve Cursor `cursor/ask_question` (BL-147). Without this, asks
   * park until cancel answers `cancelled`.
   */
  handleAskQuestion?: (params: unknown) => Promise<unknown>
  /**
   * Resolve Cursor `cursor/create_plan` (BL-148). Without this, plans
   * park until cancel answers `cancelled`.
   */
  handleCreatePlan?: (params: unknown) => Promise<unknown>
  /**
   * Profile extension flags (DES-041). `undefined` keeps Cursor
   * handlers (direct session tests); `{}` attaches none (generic).
   */
  extensions?: Readonly<Record<string, unknown>>
}

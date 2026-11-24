import type { ConnectorFile } from "@workspace/contracts"

/** One tool from MCP `tools/list` (BL-163). */
export type McpToolInfo = {
  name: string
  description?: string
}

/**
 * Short-lived MCP client session used by the mcp connector transport.
 * Adapters open stdio or URL; tests inject a fake.
 */
export type McpSession = {
  listTools(): Promise<McpToolInfo[]>
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
  close(): void
}

export type McpConnect = (
  connector: ConnectorFile,
  signal: AbortSignal
) => Promise<McpSession>

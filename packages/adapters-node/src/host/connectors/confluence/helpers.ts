import type { Connection } from "../../connection-model.ts"
import { type McpClient, type McpConnectInput } from "../../mcp/client.ts"
import { mcpServerKeyFromScope } from "../../mcp/trust.ts"

export const MCP_TRUST_REQUIRED = "mcp_trust_required"

export type ConfluencePage = {
  id: string
  title: string
  version: number
  space: string
  markdown: string
}

export type ConfluenceMcp = {
  connect: (input: McpConnectInput) => Promise<McpClient>
}

export function requireServerKey(connection: Connection): string {
  const key = mcpServerKeyFromScope(connection.scope)
  if (!key) {
    throw new Error("confluence connection needs scope.command or scope.url")
  }
  return key
}

export function spaceOf(connection: Connection): string {
  const space = connection.scope.space?.trim()
  if (!space) throw new Error("confluence connection needs scope.space")
  return space
}

export function pageIdOf(connection: Connection, entityId: string): string {
  const fromScope = connection.scope.page?.trim()
  if (fromScope) return fromScope
  const parts = entityId.split("/")
  return parts[parts.length - 1] || entityId
}

export function asPage(result: unknown): ConfluencePage {
  const page = result as ConfluencePage
  if (
    !page ||
    typeof page.id !== "string" ||
    typeof page.title !== "string" ||
    typeof page.version !== "number" ||
    typeof page.space !== "string" ||
    typeof page.markdown !== "string"
  ) {
    throw new Error("mcp get_page returned an invalid page")
  }
  return page
}

export async function withClient<T>(
  mcp: ConfluenceMcp,
  connection: Connection,
  fn: (client: McpClient) => Promise<T>
): Promise<T> {
  const client = await mcp.connect({
    command: connection.scope.command,
    url: connection.scope.url,
  })
  try {
    return await fn(client)
  } finally {
    await client.close()
  }
}

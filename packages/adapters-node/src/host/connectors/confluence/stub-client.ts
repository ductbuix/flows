import type { McpClient } from "../../mcp/client.ts"
import type { ConfluencePage } from "./index.ts"

/** In-memory stub MCP client for unit tests (BL-054). */
export function createStubMcpClient(initial?: Partial<ConfluencePage>): {
  client: McpClient
  state: ConfluencePage
} {
  const state: ConfluencePage = {
    id: initial?.id ?? "42",
    title: initial?.title ?? "Stub Page",
    version: initial?.version ?? 1,
    space: initial?.space ?? "TEAM",
    markdown: initial?.markdown ?? "# Stub\n\nHello.\n",
  }

  const client: McpClient = {
    async callTool(name, args) {
      if (name === "get_page") {
        return { ...state }
      }
      if (name === "update_page") {
        const base = Number(args.version)
        if (base !== state.version) {
          return {
            conflict: true,
            message: `version conflict: base ${base}, current ${state.version}`,
          }
        }
        if (typeof args.markdown === "string") state.markdown = args.markdown
        if (typeof args.title === "string") state.title = args.title
        state.version += 1
        return { version: state.version }
      }
      throw new Error(`unknown tool ${name}`)
    },
    async close() {
      /* no-op */
    },
  }

  return { client, state }
}

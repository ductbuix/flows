import type { ConnectionCheckResult } from "@workspace/shared"
import { connectMcp } from "../../mcp/client.ts"
import { isMcpServerAllowed } from "../../mcp/trust.ts"
import type { Connector, ConnectorPullResult } from "../types.ts"
import { confluenceDiff, confluencePublish } from "./diff-publish.ts"
import {
  MCP_TRUST_REQUIRED,
  asPage,
  pageIdOf,
  requireServerKey,
  spaceOf,
  withClient,
  type ConfluenceMcp,
  type ConfluencePage,
} from "./helpers.ts"
import {
  writePageSnapshot,
  type PageMeta,
  type PageSnapshot,
} from "./page-files.ts"

export { MCP_TRUST_REQUIRED }
export type { ConfluenceMcp, ConfluencePage }

/** Build a Confluence connector; tests inject an MCP client factory. */
export function createConfluenceConnector(
  mcp: ConfluenceMcp = { connect: connectMcp }
): Connector {
  return {
    id: "confluence",
    describe() {
      return {
        id: "confluence",
        entityKinds: ["page"],
        scopeFields: ["space", "page", "command", "url"],
        signInMethods: ["mcp"],
      }
    },
    async check(connection, home): Promise<ConnectionCheckResult> {
      if (connection.signIn !== "mcp") {
        return { ok: false, message: "confluence requires sign-in method mcp" }
      }
      let key: string
      try {
        key = requireServerKey(connection)
        spaceOf(connection)
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        }
      }
      if (!isMcpServerAllowed(home, key)) {
        return {
          ok: false,
          message: `${MCP_TRUST_REQUIRED}: allow MCP server before use`,
        }
      }
      try {
        await withClient(mcp, connection, async (client) => {
          await client.callTool("get_page", {
            space: spaceOf(connection),
            page: pageIdOf(connection, connection.scope.page ?? "check"),
          })
        })
        return { ok: true, message: "mcp sign-in ok" }
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        }
      }
    },
    async pull(input): Promise<ConnectorPullResult> {
      if (input.entityKind !== "page") {
        throw new Error(
          `confluence connector only pulls page, got ${input.entityKind}`
        )
      }
      const key = requireServerKey(input.connection)
      if (!isMcpServerAllowed(input.home, key)) {
        throw new Error(`${MCP_TRUST_REQUIRED}: allow MCP server before use`)
      }
      const space = spaceOf(input.connection)
      const pageId = pageIdOf(input.connection, input.entityId)
      const page = await withClient(mcp, input.connection, async (client) =>
        asPage(await client.callTool("get_page", { space, page: pageId }))
      )
      writePageSnapshot(input.destDir, {
        meta: {
          id: page.id,
          title: page.title,
          version: page.version,
          space: page.space,
        },
        markdown: page.markdown,
      })
      return { revision: String(page.version) }
    },
    async diff(input) {
      return confluenceDiff(input.connection, input.workCopyDir, input.baseDir)
    },
    async publish(connection, changeSet, home) {
      return confluencePublish(mcp, connection, changeSet, home)
    },
  }
}

export const confluenceConnector = createConfluenceConnector()

export type { PageMeta, PageSnapshot }

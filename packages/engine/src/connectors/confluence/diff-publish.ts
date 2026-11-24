import type { Connection } from "../../connection-model.ts"
import { isMcpServerAllowed } from "../../mcp/trust.ts"
import type { ConnectorChangeSet, ConnectorPublishResult } from "../types.ts"
import {
  MCP_TRUST_REQUIRED,
  requireServerKey,
  spaceOf,
  withClient,
  type ConfluenceMcp,
} from "./helpers.ts"
import { readPageSnapshot, unifiedDiff } from "./page-files.ts"

export async function confluenceDiff(
  connection: Connection,
  workCopyDir: string,
  baseDir: string
): Promise<ConnectorChangeSet> {
  const work = readPageSnapshot(workCopyDir)
  const base = readPageSnapshot(baseDir)
  if (!work) {
    return {
      v: 1,
      connection: connection.id,
      base: base ? String(base.meta.version) : "none",
      ops: [],
    }
  }
  const baseVersion = base ? String(base.meta.version) : "none"
  if (
    base &&
    work.markdown === base.markdown &&
    work.meta.title === base.meta.title
  ) {
    return {
      v: 1,
      connection: connection.id,
      base: baseVersion,
      ops: [],
    }
  }
  const before = base?.markdown ?? ""
  const diffText = unifiedDiff(before, work.markdown)
  return {
    v: 1,
    connection: connection.id,
    base: baseVersion,
    ops: [
      {
        op: "update_page",
        target: work.meta.id,
        summary: `update page ${work.meta.title}`,
        destructive: false,
        payload: {
          unifiedDiff: diffText,
          markdown: work.markdown,
          title: work.meta.title,
          space: work.meta.space,
          version: work.meta.version,
        },
      },
    ],
  }
}

export async function confluencePublish(
  mcp: ConfluenceMcp,
  connection: Connection,
  changeSet: ConnectorChangeSet,
  home: string
): Promise<ConnectorPublishResult> {
  const key = requireServerKey(connection)
  if (!isMcpServerAllowed(home, key)) {
    return {
      status: "rejected",
      message: `${MCP_TRUST_REQUIRED}: allow MCP server before use`,
    }
  }
  const op = changeSet.ops.find((o) => o.op === "update_page")
  if (!op) {
    return { status: "rejected", message: "no update_page op" }
  }
  const payload = op.payload as {
    markdown?: string
    title?: string
    space?: string
  }
  if (typeof payload.markdown !== "string") {
    return { status: "rejected", message: "update_page missing markdown" }
  }
  const space = payload.space ?? spaceOf(connection)
  try {
    const result = await withClient(mcp, connection, async (client) => {
      return (await client.callTool("update_page", {
        space,
        page: op.target,
        version: Number(changeSet.base),
        title: payload.title,
        markdown: payload.markdown,
      })) as { version?: number; conflict?: boolean; message?: string }
    })
    if (result?.conflict) {
      return {
        status: "conflict",
        message: result.message ?? "page version conflict",
      }
    }
    return {
      status: "applied",
      result: {
        pageId: op.target,
        version: result?.version ?? null,
        url: `confluence://${space}/${op.target}`,
      },
      undoNote: `Revert Confluence page ${op.target} to version ${changeSet.base}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/conflict|version/i.test(message)) {
      return { status: "conflict", message }
    }
    return { status: "rejected", message }
  }
}

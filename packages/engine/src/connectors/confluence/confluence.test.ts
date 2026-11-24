import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { connectionSchema } from "../../connection-model.ts"
import { pullEntity, resolveScopeEntity } from "../../library.ts"
import { connectMcp } from "../../mcp/client.ts"
import {
  allowMcpServerAlways,
  clearMcpOnceGrants,
  revokeMcpServer,
} from "../../mcp/trust.ts"
import { libraryEntityDir } from "../../paths.ts"
import { clearConnectors, registerConnector } from "../registry.ts"
import {
  MCP_TRUST_REQUIRED,
  createConfluenceConnector,
  confluenceConnector,
} from "./index.ts"
import { PAGE_MD, PAGE_META, readPageSnapshot } from "./page-files.ts"
import { createStubMcpClient } from "./stub-client.ts"

const dirs: string[] = []
const stubServer = join(
  dirname(fileURLToPath(import.meta.url)),
  "stub-mcp-server.mjs"
)

afterEach(() => {
  clearConnectors()
  clearMcpOnceGrants()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

beforeEach(() => {
  clearMcpOnceGrants()
})

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

function seedConnection(home: string, scope: Record<string, string> = {}) {
  return connectionSchema.parse({
    id: "conf-team",
    connector: "confluence",
    name: "Team space",
    scope: {
      space: "TEAM",
      page: "42",
      command: `node ${stubServer}`,
      ...scope,
    },
    signIn: "mcp",
    refresh: "1h",
  })
}

describe("confluence connector", () => {
  it("describe lists page, space scope, and mcp sign-in", () => {
    const desc = confluenceConnector.describe()
    expect(desc.id).toBe("confluence")
    expect(desc.entityKinds).toEqual(["page"])
    expect(desc.scopeFields).toContain("space")
    expect(desc.signInMethods).toEqual(["mcp"])
  })

  it("resolveScopeEntity builds space/page and skips command", () => {
    const home = tempDir("flowapp-conf-scope-")
    registerConnector(confluenceConnector)
    const conn = seedConnection(home)
    expect(resolveScopeEntity(conn)).toEqual({
      kind: "page",
      entityId: "TEAM/42",
      title: "Team space",
    })
  })

  it("check requires MCP trust then succeeds with stub client", async () => {
    const home = tempDir("flowapp-conf-check-")
    const { client } = createStubMcpClient()
    const connector = createConfluenceConnector({
      connect: async () => client,
    })
    registerConnector(connector)
    const conn = seedConnection(home, { command: "stub://memory" })

    const denied = await connector.check(conn, home)
    expect(denied.ok).toBe(false)
    expect(denied.message).toContain(MCP_TRUST_REQUIRED)

    allowMcpServerAlways(home, "stub://memory")
    const ok = await connector.check(conn, home)
    expect(ok).toEqual({ ok: true, message: "mcp sign-in ok" })
  })

  it("pull writes markdown and meta; revision is page version", async () => {
    const home = tempDir("flowapp-conf-pull-")
    const { client, state } = createStubMcpClient({
      version: 7,
      markdown: "# Hello\n",
      title: "Hello",
    })
    const connector = createConfluenceConnector({
      connect: async () => client,
    })
    registerConnector(connector)
    const conn = seedConnection(home, { command: "stub://pull" })
    allowMcpServerAlways(home, "stub://pull")

    const pulled = await pullEntity({
      home,
      connection: conn,
      kind: "page",
      entityId: "TEAM/42",
      force: true,
    })
    expect(pulled.revision).toBe("7")
    const snap = readPageSnapshot(
      join(
        libraryEntityDir(home, "conf-team", "page", "TEAM/42"),
        pulled.revision
      )
    )
    expect(snap?.meta).toMatchObject({
      id: "42",
      title: "Hello",
      version: 7,
      space: "TEAM",
    })
    expect(snap?.markdown).toBe("# Hello\n")
    expect(state.version).toBe(7)
  })

  it("diff makes update_page with unified diff; publish checks version", async () => {
    const home = tempDir("flowapp-conf-diff-")
    const { client, state } = createStubMcpClient({
      version: 3,
      markdown: "v1\n",
      title: "Doc",
    })
    const connector = createConfluenceConnector({
      connect: async () => client,
    })
    registerConnector(connector)
    const conn = seedConnection(home, { command: "stub://diff" })
    allowMcpServerAlways(home, "stub://diff")

    const baseDir = tempDir("flowapp-conf-base-")
    const workDir = tempDir("flowapp-conf-work-")
    writeFileSync(
      join(baseDir, PAGE_META),
      JSON.stringify({
        id: "42",
        title: "Doc",
        version: 3,
        space: "TEAM",
      })
    )
    writeFileSync(join(baseDir, PAGE_MD), "v1\n")
    writeFileSync(
      join(workDir, PAGE_META),
      JSON.stringify({
        id: "42",
        title: "Doc",
        version: 3,
        space: "TEAM",
      })
    )
    writeFileSync(join(workDir, PAGE_MD), "v2\n")

    const changeSet = await connector.diff({
      connection: conn,
      workCopyDir: workDir,
      baseDir,
    })
    expect(changeSet.base).toBe("3")
    expect(changeSet.ops).toHaveLength(1)
    expect(changeSet.ops[0]?.op).toBe("update_page")
    const payload = changeSet.ops[0]?.payload as {
      unifiedDiff: string
      markdown: string
    }
    expect(payload.unifiedDiff).toContain("-v1")
    expect(payload.unifiedDiff).toContain("+v2")
    expect(payload.markdown).toBe("v2\n")

    const applied = await connector.publish(conn, changeSet, home)
    expect(applied.status).toBe("applied")
    expect(state.version).toBe(4)
    expect(state.markdown).toBe("v2\n")

    const conflict = await connector.publish(conn, changeSet, home)
    expect(conflict.status).toBe("conflict")
  })

  it("talks to the stub MCP server process over stdio", async () => {
    const home = tempDir("flowapp-conf-stdio-")
    const command = `node ${stubServer}`
    allowMcpServerAlways(home, command)
    const connector = createConfluenceConnector({ connect: connectMcp })
    registerConnector(connector)
    const conn = seedConnection(home, { command })

    const check = await connector.check(conn, home)
    expect(check.ok).toBe(true)

    const dest = tempDir("flowapp-conf-stdio-dest-")
    const pulled = await connector.pull({
      connection: conn,
      entityKind: "page",
      entityId: "TEAM/42",
      entityRoot: dest,
      destDir: dest,
      home,
    })
    expect(pulled?.revision).toBe("1")
    expect(existsSync(join(dest, PAGE_MD))).toBe(true)
    expect(readFileSync(join(dest, PAGE_MD), "utf8")).toContain("Stub")

    revokeMcpServer(home, command)
    const denied = await connector.check(conn, home)
    expect(denied.ok).toBe(false)
    expect(denied.message).toContain(MCP_TRUST_REQUIRED)
  })
})

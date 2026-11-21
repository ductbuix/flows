import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  clearMcpOnceGrants,
  createEngine,
  isMcpServerAllowed,
  type Engine,
} from "@workspace/engine"
import { mcpTrustStatusSchema } from "@workspace/shared"
import { createApp } from "./app.ts"

const dirs: string[] = []

afterEach(() => {
  clearMcpOnceGrants()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function makeApp(): { app: ReturnType<typeof createApp>; engine: Engine } {
  const home = mkdtempSync(join(tmpdir(), "flowapp-mcp-api-"))
  dirs.push(home)
  const engine = createEngine({ home })
  return { app: createApp({ engine }), engine }
}

describe("mcp-trust routes", () => {
  it("lists, allows always, and revokes", async () => {
    const { app, engine } = makeApp()
    const key = "node stub-mcp-server.mjs"

    const empty = await app.request("/api/mcp-trust")
    expect(empty.status).toBe(200)
    expect(mcpTrustStatusSchema.parse(await empty.json()).servers).toEqual([])

    const allow = await app.request("/api/mcp-trust", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, grant: "always" }),
    })
    expect(allow.status).toBe(200)
    const listed = mcpTrustStatusSchema.parse(await allow.json())
    expect(listed.servers.map((s) => s.key)).toEqual([key])
    expect(isMcpServerAllowed(engine.home, key)).toBe(true)

    const revoke = await app.request("/api/mcp-trust", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, grant: "none" }),
    })
    expect(revoke.status).toBe(200)
    expect(mcpTrustStatusSchema.parse(await revoke.json()).servers).toEqual([])
    expect(isMcpServerAllowed(engine.home, key)).toBe(false)
  })

  it("trust once does not persist to the list", async () => {
    const { app, engine } = makeApp()
    const key = "http://127.0.0.1:9/mcp"
    const once = await app.request("/api/mcp-trust", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, grant: "once" }),
    })
    expect(once.status).toBe(200)
    expect(mcpTrustStatusSchema.parse(await once.json()).servers).toEqual([])
    expect(isMcpServerAllowed(engine.home, key)).toBe(true)
  })
})

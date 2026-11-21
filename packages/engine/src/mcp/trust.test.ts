import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  allowMcpServerAlways,
  allowMcpServerOnce,
  clearMcpOnceGrants,
  isMcpServerAllowed,
  listAllowedMcpServers,
  mcpServerKeyFromScope,
  revokeMcpServer,
} from "./trust.ts"

const dirs: string[] = []

beforeEach(() => {
  clearMcpOnceGrants()
})

afterEach(() => {
  clearMcpOnceGrants()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "flowapp-mcp-trust-"))
  dirs.push(dir)
  return dir
}

describe("mcp trust", () => {
  it("reads command or url from scope", () => {
    expect(mcpServerKeyFromScope({ command: " node stub.mjs " })).toBe(
      "node stub.mjs"
    )
    expect(mcpServerKeyFromScope({ url: "http://127.0.0.1:9/mcp" })).toBe(
      "http://127.0.0.1:9/mcp"
    )
    expect(mcpServerKeyFromScope({ command: "a", url: "b" })).toBe("a")
    expect(mcpServerKeyFromScope({})).toBeNull()
  })

  it("allows always, lists, and revokes", () => {
    const home = tempHome()
    const key = "node stub-mcp-server.mjs"
    expect(isMcpServerAllowed(home, key)).toBe(false)
    allowMcpServerAlways(home, key)
    expect(isMcpServerAllowed(home, key)).toBe(true)
    expect(listAllowedMcpServers(home).map((s) => s.key)).toEqual([key])
    revokeMcpServer(home, key)
    expect(isMcpServerAllowed(home, key)).toBe(false)
    expect(listAllowedMcpServers(home)).toEqual([])
  })

  it("trust once covers the session without persisting", () => {
    const home = tempHome()
    const key = "http://127.0.0.1:9/mcp"
    allowMcpServerOnce(key)
    expect(isMcpServerAllowed(home, key)).toBe(true)
    expect(listAllowedMcpServers(home)).toEqual([])
    clearMcpOnceGrants()
    expect(isMcpServerAllowed(home, key)).toBe(false)
  })
})

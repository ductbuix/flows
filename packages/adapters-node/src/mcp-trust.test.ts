import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  clearMcpOnceGrants,
  createNodeMcpTrustPort,
} from "./mcp-trust.ts"

describe("createNodeMcpTrustPort", () => {
  let dir: string

  afterEach(() => {
    clearMcpOnceGrants()
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it("persists always grants and revokes them", () => {
    dir = mkdtempSync(join(tmpdir(), "flowapp-mcp-trust-"))
    const port = createNodeMcpTrustPort(dir)
    expect(port.listServers()).toEqual([])

    const allowed = port.setGrant("npx demo", "always")
    expect(allowed).toHaveLength(1)
    expect(allowed[0]?.key).toBe("npx demo")
    expect(port.listServers()).toEqual(allowed)

    expect(port.setGrant("npx demo", "none")).toEqual([])
    expect(port.listServers()).toEqual([])
  })
})

import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  asMcpLaunchSpecs,
  cleanupPlacedMcp,
  FLOWS_MCP_KEY,
  placeMcp,
  toAcpMcpServers,
} from "./place-mcp.ts"

describe("placeMcp", () => {
  it("writes only the Flows gateway entry into .cursor/mcp.json", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "flows-place-mcp-"))
    await placeMcp(
      [
        {
          command: "tsx",
          args: ["packages/mcp-gateway/src/cli.ts", "--socket", "/tmp/s"],
          env: { FLOWS_TOKEN: "t" },
        },
        { command: "other", args: ["nope"] },
      ],
      workDir
    )
    const raw = readFileSync(join(workDir, ".cursor/mcp.json"), "utf8")
    const json = JSON.parse(raw) as {
      mcpServers: Record<string, unknown>
    }
    expect(Object.keys(json.mcpServers)).toEqual([FLOWS_MCP_KEY])
    expect(json.mcpServers[FLOWS_MCP_KEY]).toEqual({
      command: "tsx",
      args: ["packages/mcp-gateway/src/cli.ts", "--socket", "/tmp/s"],
      env: { FLOWS_TOKEN: "t" },
    })
  })

  it("deletes mcp.json when it did not exist before", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "flows-place-mcp-rm-"))
    await placeMcp([{ command: "echo", args: ["hi"] }], workDir)
    expect(existsSync(join(workDir, ".cursor/mcp.json"))).toBe(true)
    await cleanupPlacedMcp(workDir)
    expect(existsSync(join(workDir, ".cursor/mcp.json"))).toBe(false)
  })

  it("restores prior mcp.json content", async () => {
    const { mkdirSync } = await import("node:fs")
    const workDir = mkdtempSync(join(tmpdir(), "flows-place-mcp-restore-"))
    mkdirSync(join(workDir, ".cursor"), { recursive: true })
    const path = join(workDir, ".cursor/mcp.json")
    const prior = '{\n  "mcpServers": { "user": { "command": "x" } }\n}\n'
    writeFileSync(path, prior)
    await placeMcp([{ command: "flows-gw" }], workDir)
    expect(JSON.parse(readFileSync(path, "utf8")).mcpServers).toHaveProperty(
      FLOWS_MCP_KEY
    )
    await cleanupPlacedMcp(workDir)
    expect(readFileSync(path, "utf8")).toBe(prior)
  })
})

describe("toAcpMcpServers / asMcpLaunchSpecs", () => {
  it("maps env object to ACP name/value array", () => {
    expect(
      toAcpMcpServers([{ command: "node", args: ["gw.js"], env: { T: "1" } }])
    ).toEqual([
      {
        name: FLOWS_MCP_KEY,
        type: "stdio",
        command: "node",
        args: ["gw.js"],
        env: [{ name: "T", value: "1" }],
      },
    ])
  })

  it("parses launch specs from SessionSpec-shaped input", () => {
    expect(
      asMcpLaunchSpecs([
        { command: "npx", args: ["gw"], env: { A: "b" } },
        { nope: true },
      ])
    ).toEqual([{ command: "npx", args: ["gw"], env: { A: "b" } }])
  })
})

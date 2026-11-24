import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import { describe, expect, it } from "vitest"
import { isEngineError } from "../rpc/map-error.ts"
import { createFakeClock, createFakeDocumentStore } from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { checkConnector } from "./check.ts"
import type { McpConnect, McpSession, McpToolInfo } from "./mcp-session.ts"
import { createMcpTransport } from "./mcp-transport.ts"
import { createConnectorTransportRegistry } from "./registry.ts"
import { createConnectorRuntime } from "./runtime.ts"
import { connectorPath, createConnectorService } from "./service.ts"

const seed: ConnectorFile = {
  id: "opensearch",
  name: "OpenSearch",
  transport: "mcp",
  how: "stub-mcp",
  auth: "none",
  capabilities: [
    {
      name: "search",
      desc: "old desc",
      write: false,
      allowed: true,
    },
    {
      name: "delete_index",
      desc: "Danger",
      write: true,
      allowed: false,
    },
  ],
}

function fakeSession(tools: McpToolInfo[], calls: string[] = []): McpSession {
  return {
    async listTools() {
      return tools
    },
    async callTool(name, args) {
      calls.push(`${name}:${JSON.stringify(args)}`)
      return {
        content: [{ type: "text", text: `ok:${name}` }],
      }
    },
    close() {},
  }
}

function stack(connect: McpConnect, file: ConnectorFile = seed) {
  const docs = createFakeDocumentStore()
  docs.write(connectorPath(file.id), connectorToYaml(file))
  const connectors = createConnectorService({ docs })
  const transports = createConnectorTransportRegistry([
    createMcpTransport({ connect }),
  ])
  const runtime = createConnectorRuntime({ connectors, transports })
  return { runtime, connectors }
}

describe("ConnectorRuntime + mcp transport", () => {
  it("lists tools as capabilities on check and keeps allowed flags", async () => {
    const tools: McpToolInfo[] = [
      { name: "search", description: "Query indices" },
      { name: "delete_index", description: "Drop an index" },
      { name: "ping" },
    ]
    const { runtime, connectors } = stack(async () => fakeSession(tools))
    const bus = new UpdateBus()
    const clock = createFakeClock(Date.parse("2026-11-24T14:00:00.000Z"))

    const outcome = await checkConnector(
      { service: connectors, runtime, bus, clock },
      "opensearch",
      new AbortController().signal
    )
    expect(outcome.status).toBe("connected")
    expect(outcome.detail).toContain("search")

    const after = connectors.get("opensearch")
    expect(after?.connector.capabilities).toEqual([
      {
        name: "search",
        desc: "Query indices",
        write: false,
        allowed: true,
      },
      {
        name: "delete_index",
        desc: "Drop an index",
        write: true,
        allowed: false,
      },
      {
        name: "ping",
        desc: "",
        write: false,
        allowed: true,
      },
    ])
  })

  it("calls an allowed tool through tools/call", async () => {
    const seen: string[] = []
    const { runtime } = stack(async () =>
      fakeSession([{ name: "search" }], seen)
    )
    const result = await runtime.call(
      "opensearch",
      "search",
      ['{"q":"error"}'],
      new AbortController().signal
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("ok:search")
    expect(seen).toEqual(['search:{"q":"error"}'])
  })

  it("refuses a capability that is off with policy_denied", async () => {
    const { runtime } = stack(async () =>
      fakeSession([{ name: "delete_index" }])
    )
    try {
      await runtime.call(
        "opensearch",
        "delete_index",
        [],
        new AbortController().signal
      )
      expect.unreachable("expected policy_denied")
    } catch (err) {
      expect(isEngineError(err)).toBe(true)
      if (isEngineError(err)) expect(err.code).toBe("policy_denied")
    }
  })

  it("returns expired when connect fails", async () => {
    const { runtime } = stack(async () => {
      throw new Error("spawn failed")
    })
    const result = await runtime.check(
      "opensearch",
      new AbortController().signal
    )
    expect(result.ok).toBe(false)
    expect(result.detail).toContain("spawn failed")
  })
})

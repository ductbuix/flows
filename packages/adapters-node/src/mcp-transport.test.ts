import { fileURLToPath } from "node:url"
import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import {
  checkConnector,
  connectorPath,
  createConnectorRuntime,
  createConnectorService,
  createConnectorTransportRegistry,
  UpdateBus,
} from "@workspace/core"
import {
  createFakeClock,
  createFakeDocumentStore,
} from "@workspace/core/testing"
import { describe, expect, it } from "vitest"
import { createNodeMcpTransport } from "./mcp-transport.ts"

const stubPath = fileURLToPath(
  new URL("./stub-mcp-server.mjs", import.meta.url)
)

function mcpConnector(overrides: Partial<ConnectorFile> = {}): ConnectorFile {
  return {
    id: "stub-mcp",
    name: "Stub MCP",
    transport: "mcp",
    how: `node ${stubPath}`,
    auth: "none",
    capabilities: [
      {
        name: "fail",
        desc: "Always errors",
        write: true,
        allowed: false,
      },
    ],
    ...overrides,
  }
}

function stack(seed: ConnectorFile = mcpConnector()) {
  const docs = createFakeDocumentStore()
  docs.write(connectorPath(seed.id), connectorToYaml(seed))
  const connectors = createConnectorService({ docs })
  const runtime = createConnectorRuntime({
    connectors,
    transports: createConnectorTransportRegistry([createNodeMcpTransport()]),
  })
  return { runtime, connectors }
}

describe("Node MCP connector transport", () => {
  it("lists tools as capabilities on check against a stdio fixture", async () => {
    const { runtime, connectors } = stack()
    const bus = new UpdateBus()
    const clock = createFakeClock(Date.parse("2026-11-24T15:00:00.000Z"))

    const outcome = await checkConnector(
      { service: connectors, runtime, bus, clock },
      "stub-mcp",
      new AbortController().signal
    )
    expect(outcome.status).toBe("connected")
    expect(outcome.detail).toContain("echo")

    const caps = connectors.get("stub-mcp")?.connector.capabilities ?? []
    expect(caps.map((c) => c.name)).toEqual(["echo", "fail"])
    expect(caps.find((c) => c.name === "fail")?.allowed).toBe(false)
    expect(caps.find((c) => c.name === "echo")?.allowed).toBe(true)
  })

  it("calls an allowed tool through the capability gate", async () => {
    const { runtime, connectors } = stack()
    await checkConnector(
      {
        service: connectors,
        runtime,
        bus: new UpdateBus(),
        clock: createFakeClock(Date.parse("2026-11-24T15:00:00.000Z")),
      },
      "stub-mcp",
      new AbortController().signal
    )

    const result = await runtime.call(
      "stub-mcp",
      "echo",
      ['{"message":"hi"}'],
      new AbortController().signal
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("hi")
  })

  it("refuses a capability that is off with policy_denied", async () => {
    const { runtime, connectors } = stack()
    await checkConnector(
      {
        service: connectors,
        runtime,
        bus: new UpdateBus(),
        clock: createFakeClock(Date.parse("2026-11-24T15:00:00.000Z")),
      },
      "stub-mcp",
      new AbortController().signal
    )

    await expect(
      runtime.call("stub-mcp", "fail", [], new AbortController().signal)
    ).rejects.toMatchObject({ code: "policy_denied" })
  })
})

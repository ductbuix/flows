import { describe, expect, it } from "vitest"
import {
  createLinkedTransports,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { parseGatewayArgs } from "./args.ts"
import { connectEngineBridge, type EngineCaller } from "./engine-bridge.ts"
import { createMcpGateway } from "./gateway.ts"
import { MCP_PROTOCOL_VERSION } from "./mcp-types.ts"
import { startStubSocketServer } from "./stub-socket.ts"
import { parseToolsSpec } from "./tools-spec.ts"

const sampleTools = parseToolsSpec({
  tools: [
    {
      name: "rally.artifact_read",
      description: "Read a Rally artifact",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "github.pr_create",
      inputSchema: { type: "object" },
    },
  ],
}).tools

/** MCP client fixture: RpcPeer on the client half of linked transports. */
async function withLinkedGateway(engine: EngineCaller) {
  const [clientTransport, serverTransport] = createLinkedTransports()
  const gateway = createMcpGateway({
    tools: sampleTools,
    engine,
    transport: serverTransport,
  })
  const client = new RpcPeer(clientTransport)
  return {
    client,
    gateway,
    close() {
      client.close()
      gateway.close()
    },
  }
}

describe("parseGatewayArgs", () => {
  it("reads --tools and --socket", () => {
    expect(
      parseGatewayArgs(["--tools", "/t.json", "--socket", "/e.sock"])
    ).toEqual({ toolsPath: "/t.json", socketPath: "/e.sock" })
  })

  it("rejects missing flags", () => {
    expect(() => parseGatewayArgs(["--tools", "/t.json"])).toThrow(/socket/)
  })
})

describe("parseToolsSpec", () => {
  it("requires tools array with names", () => {
    expect(() => parseToolsSpec({ tools: [{ name: "" }] })).toThrow()
    expect(parseToolsSpec({ tools: [{ name: "a" }] }).tools[0]?.name).toBe("a")
  })
})

describe("MCP gateway", () => {
  it("lists tools from the launch spec", async () => {
    const engine: EngineCaller = {
      call: async () => ({ content: [{ type: "text", text: "no" }] }),
      close() {},
    }
    const { client, close } = await withLinkedGateway(engine)
    try {
      const init = (await client.request("initialize", {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "fixture", version: "0" },
      })) as { protocolVersion: string; serverInfo: { name: string } }
      expect(init.protocolVersion).toBe(MCP_PROTOCOL_VERSION)
      expect(init.serverInfo.name).toBe("flows-mcp-gateway")

      client.notify("notifications/initialized")

      const listed = (await client.request("tools/list")) as {
        tools: Array<{ name: string; description?: string }>
      }
      expect(listed.tools.map((t) => t.name)).toEqual([
        "rally.artifact_read",
        "github.pr_create",
      ])
      expect(listed.tools[0]?.description).toBe("Read a Rally artifact")
    } finally {
      close()
    }
  })

  it("forwards tools/call to the engine and returns its result", async () => {
    const seen: Array<{ name: string; args: Record<string, unknown> }> = []
    const engine: EngineCaller = {
      async call(name, args) {
        seen.push({ name, args })
        return {
          content: [{ type: "text", text: `ok:${name}:${args.id}` }],
        }
      },
      close() {},
    }
    const { client, close } = await withLinkedGateway(engine)
    try {
      const result = (await client.request("tools/call", {
        name: "rally.artifact_read",
        arguments: { id: "US-1" },
      })) as { content: Array<{ text: string }> }
      expect(seen).toEqual([
        { name: "rally.artifact_read", args: { id: "US-1" } },
      ])
      expect(result.content[0]?.text).toBe("ok:rally.artifact_read:US-1")
    } finally {
      close()
    }
  })

  it("rejects unknown tool names", async () => {
    const engine: EngineCaller = {
      call: async () => ({ content: [{ type: "text", text: "no" }] }),
      close() {},
    }
    const { client, close } = await withLinkedGateway(engine)
    try {
      const err = await client.request("tools/call", { name: "nope" }).then(
        () => null,
        (e: unknown) => e
      )
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      expect((err as JsonRpcResponseError).message).toMatch(/unknown tool/)
    } finally {
      close()
    }
  })
})

describe("MCP gateway over stub socket", () => {
  it("lists tools and forwards a call through the unix socket", async () => {
    const stub = await startStubSocketServer({
      result: {
        content: [{ type: "text", text: "from-engine" }],
      },
    })
    try {
      const engine = await connectEngineBridge(stub.path)
      const [clientTransport, serverTransport] = createLinkedTransports()
      const gateway = createMcpGateway({
        tools: sampleTools,
        engine,
        transport: serverTransport,
      })
      const client = new RpcPeer(clientTransport)

      const listed = (await client.request("tools/list")) as {
        tools: Array<{ name: string }>
      }
      expect(listed.tools).toHaveLength(2)

      const result = (await client.request("tools/call", {
        name: "github.pr_create",
        arguments: { title: "hi" },
      })) as { content: Array<{ text: string }> }

      expect(result.content[0]?.text).toBe("from-engine")
      expect(stub.calls).toEqual([
        { name: "github.pr_create", arguments: { title: "hi" } },
      ])

      client.close()
      gateway.close()
    } finally {
      await stub.close()
    }
  })
})

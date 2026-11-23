import {
  JSONRPC_INVALID_PARAMS,
  JsonRpcResponseError,
  RpcPeer,
  type RequestContext,
  type Transport,
} from "@workspace/protocol"
import type { EngineCaller } from "./engine-bridge.ts"
import { asCallToolResult, MCP_PROTOCOL_VERSION } from "./mcp-types.ts"
import type { ToolSpec } from "./tools-spec.ts"

export type McpGateway = {
  peer: RpcPeer
  close(): void
}

export type CreateMcpGatewayOptions = {
  tools: ToolSpec[]
  engine: EngineCaller
  transport: Transport
  serverInfo?: { name: string; version: string }
}

/**
 * Stdio-facing MCP server: lists the launch tools and forwards each
 * `tools/call` to the engine bridge. No credentials or connector code.
 */
export function createMcpGateway(opts: CreateMcpGatewayOptions): McpGateway {
  const peer = new RpcPeer(opts.transport)
  const tools = opts.tools
  const info = opts.serverInfo ?? {
    name: "flows-mcp-gateway",
    version: "0.0.0",
  }

  peer.onRequest("initialize", () => ({
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: info,
  }))

  peer.onRequest("tools/list", () => ({
    tools: tools.map((t) => ({
      name: t.name,
      ...(t.description !== undefined ? { description: t.description } : {}),
      inputSchema: t.inputSchema,
    })),
  }))

  peer.onRequest("tools/call", async (params, ctx: RequestContext) => {
    const name = readToolName(params)
    const args = readToolArgs(params)
    if (!tools.some((t) => t.name === name)) {
      throw new JsonRpcResponseError({
        code: JSONRPC_INVALID_PARAMS,
        message: `unknown tool: ${name}`,
      })
    }
    const raw = await opts.engine.call(name, args, { signal: ctx.signal })
    return asCallToolResult(raw)
  })

  peer.onRequest("ping", () => ({}))

  // Client may send notifications/initialized; ignore quietly.
  peer.onNotification("notifications/initialized", () => {})

  return {
    peer,
    close() {
      peer.close()
      opts.engine.close()
    },
  }
}

function readToolName(params: unknown): string {
  if (
    params &&
    typeof params === "object" &&
    "name" in params &&
    typeof (params as { name: unknown }).name === "string"
  ) {
    return (params as { name: string }).name
  }
  throw new JsonRpcResponseError({
    code: JSONRPC_INVALID_PARAMS,
    message: "tools/call requires name",
  })
}

function readToolArgs(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== "object") return {}
  const args = (params as { arguments?: unknown }).arguments
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>
  }
  return {}
}

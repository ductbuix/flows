import { createServer, type Server, type Socket } from "node:net"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  JSONRPC_INVALID_PARAMS,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { GATEWAY_CALL_METHOD } from "./engine-bridge.ts"
import type { CallToolResult } from "./mcp-types.ts"

export type StubCall = {
  name: string
  arguments: Record<string, unknown>
}

export type StubSocketServer = {
  path: string
  calls: StubCall[]
  close(): Promise<void>
}

/**
 * Engine-side stub: listens on a temp unix socket and answers
 * `gateway/call` with a fixed or custom result.
 */
export async function startStubSocketServer(opts?: {
  /** When set, refuse calls whose token does not match. */
  token?: string
  result?:
    | CallToolResult
    | ((call: StubCall) => CallToolResult | Promise<CallToolResult>)
}): Promise<StubSocketServer> {
  const dir = mkdtempSync(join(tmpdir(), "flows-mcp-gw-"))
  const path = join(dir, "engine.sock")
  const calls: StubCall[] = []
  const peers: RpcPeer[] = []
  const sockets: Socket[] = []

  const handler =
    opts?.result ??
    ((call: StubCall): CallToolResult => ({
      content: [{ type: "text", text: JSON.stringify(call) }],
    }))

  const server: Server = createServer((socket) => {
    sockets.push(socket)
    const transport = ndjsonTransport(socket, socket)
    const peer = new RpcPeer(transport)
    peers.push(peer)
    peer.onRequest(GATEWAY_CALL_METHOD, async (params) => {
      const name =
        params &&
        typeof params === "object" &&
        "name" in params &&
        typeof (params as { name: unknown }).name === "string"
          ? (params as { name: string }).name
          : ""
      const token =
        params &&
        typeof params === "object" &&
        "token" in params &&
        typeof (params as { token: unknown }).token === "string"
          ? (params as { token: string }).token
          : ""
      if (opts?.token !== undefined && token !== opts.token) {
        throw new JsonRpcResponseError({
          code: JSONRPC_INVALID_PARAMS,
          message: "unknown step token",
        })
      }
      const argsRaw =
        params && typeof params === "object"
          ? (params as { arguments?: unknown }).arguments
          : undefined
      const args =
        argsRaw && typeof argsRaw === "object" && !Array.isArray(argsRaw)
          ? (argsRaw as Record<string, unknown>)
          : {}
      const call = { name, arguments: args }
      calls.push(call)
      return typeof handler === "function" ? handler(call) : handler
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(path, () => resolve())
  })

  return {
    path,
    calls,
    async close() {
      for (const peer of peers) peer.close()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}

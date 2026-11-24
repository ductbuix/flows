import { createServer, type Server, type Socket } from "node:net"
import { unlink } from "node:fs/promises"
import {
  GATEWAY_CALL_METHOD,
  type GatewaySocketCall,
  type GatewaySocketHandle,
  type GatewaySocketListenOpts,
  type GatewaySocketServer,
} from "@workspace/core"
import {
  JSONRPC_INVALID_PARAMS,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"

/**
 * Unix-domain socket server for packages/mcp-gateway (BL-166).
 * Refuses `gateway/call` when the token does not match the step.
 */
export function createNodeGatewaySocketServer(): GatewaySocketServer {
  return {
    listen(opts) {
      return listenUnix(opts)
    },
  }
}

async function listenUnix(
  opts: GatewaySocketListenOpts
): Promise<GatewaySocketHandle> {
  await unlinkQuiet(opts.path)

  const peers: RpcPeer[] = []
  const sockets: Socket[] = []
  const server: Server = createServer((socket) => {
    sockets.push(socket)
    const transport = ndjsonTransport(socket, socket)
    const peer = new RpcPeer(transport)
    peers.push(peer)
    peer.onRequest(GATEWAY_CALL_METHOD, async (params, ctx) => {
      const call = parseCall(params)
      if (call.token !== opts.token) {
        throw new JsonRpcResponseError({
          code: JSONRPC_INVALID_PARAMS,
          message: "unknown step token",
          data: { code: "policy_denied" },
        })
      }
      return opts.onCall(
        { name: call.name, arguments: call.arguments },
        ctx.signal
      )
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(opts.path, () => resolve())
  })

  return {
    path: opts.path,
    async close() {
      for (const peer of peers) peer.close()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
      await unlinkQuiet(opts.path)
    },
  }
}

type ParsedCall = GatewaySocketCall & { token: string }

function parseCall(params: unknown): ParsedCall {
  if (!params || typeof params !== "object") {
    throw new JsonRpcResponseError({
      code: JSONRPC_INVALID_PARAMS,
      message: "gateway/call requires an object",
    })
  }
  const obj = params as Record<string, unknown>
  const name = obj.name
  const token = obj.token
  if (typeof name !== "string" || name === "") {
    throw new JsonRpcResponseError({
      code: JSONRPC_INVALID_PARAMS,
      message: "gateway/call requires name",
    })
  }
  if (typeof token !== "string" || token === "") {
    throw new JsonRpcResponseError({
      code: JSONRPC_INVALID_PARAMS,
      message: "gateway/call requires token",
    })
  }
  const argsRaw = obj.arguments
  const args =
    argsRaw && typeof argsRaw === "object" && !Array.isArray(argsRaw)
      ? (argsRaw as Record<string, unknown>)
      : {}
  return { name, token, arguments: args }
}

async function unlinkQuiet(path: string): Promise<void> {
  try {
    await unlink(path)
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      return
    }
    throw err
  }
}

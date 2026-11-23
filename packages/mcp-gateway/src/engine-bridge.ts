import { createConnection, type Socket } from "node:net"
import { RpcPeer, type RequestOptions } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import type { CallToolResult } from "./mcp-types.ts"

export const GATEWAY_CALL_METHOD = "gateway/call"

export type EngineCaller = {
  call(
    name: string,
    args: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<CallToolResult>
  close(): void
}

type SocketPair = { readable: Socket; writable: Socket }

function socketPair(socket: Socket): SocketPair {
  return { readable: socket, writable: socket }
}

/**
 * JSON-RPC client over a unix domain socket (ndjson). Speaks
 * `gateway/call` so the engine can run the permission chain later.
 */
export function connectEngineBridge(socketPath: string): Promise<EngineCaller> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath }, () => {
      const { readable, writable } = socketPair(socket)
      const transport = ndjsonTransport(readable, writable)
      const peer = new RpcPeer(transport)
      resolve({
        call(name, args, options) {
          return peer.request(
            GATEWAY_CALL_METHOD,
            { name, arguments: args },
            options
          ) as Promise<CallToolResult>
        },
        close() {
          peer.close()
        },
      })
    })
    socket.once("error", reject)
  })
}

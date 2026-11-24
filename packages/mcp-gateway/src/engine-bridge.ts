import { createConnection, type Socket } from "node:net"
import { RpcPeer, type RequestOptions } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import type { CallToolResult } from "./mcp-types.ts"

export const GATEWAY_CALL_METHOD = "gateway/call"
/** Env var the engine puts in the launch spec (BL-166). */
export const GATEWAY_TOKEN_ENV = "FLOWS_GATEWAY_TOKEN"

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
 * `gateway/call` with the per-step token so the engine can auth.
 */
export function connectEngineBridge(
  socketPath: string,
  token: string
): Promise<EngineCaller> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath }, () => {
      const { readable, writable } = socketPair(socket)
      const transport = ndjsonTransport(readable, writable)
      const peer = new RpcPeer(transport)
      resolve({
        call(name, args, options) {
          return peer.request(
            GATEWAY_CALL_METHOD,
            { name, arguments: args, token },
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

/** Read the step token from env (set by the engine launch spec). */
export function gatewayTokenFromEnv(
  env: Record<string, string | undefined> = process.env
): string {
  const token = env[GATEWAY_TOKEN_ENV]
  if (!token) {
    throw new Error(`missing env ${GATEWAY_TOKEN_ENV}`)
  }
  return token
}

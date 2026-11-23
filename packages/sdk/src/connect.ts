import type { Transport } from "@workspace/protocol"
import { openWebSocketTransport } from "./ws-transport.ts"

export type TransportSource = Transport | (() => Transport | Promise<Transport>)

export type CreateClientConnectOptions = {
  readonly transport?: TransportSource
  readonly url?: string
  readonly token?: string
}

export function resolveConnect(
  options: CreateClientConnectOptions
): () => Promise<Transport> {
  const { transport, url, token } = options
  if (transport !== undefined && url !== undefined) {
    throw new Error("createClient: pass transport or url, not both")
  }
  if (transport === undefined && url === undefined) {
    throw new Error("createClient: transport or url is required")
  }
  if (url !== undefined) {
    return () => openWebSocketTransport(url, token)
  }
  if (typeof transport === "function") {
    return async () => transport()
  }
  let used = false
  return async () => {
    if (used) {
      throw new Error(
        "createClient: static transport already closed; pass a factory or url to reconnect"
      )
    }
    used = true
    return transport as Transport
  }
}

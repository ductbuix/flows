import { wsTransport, type Transport } from "@workspace/protocol"

export type TransportSource = Transport | (() => Transport | Promise<Transport>)

export type CreateClientConnectOptions = {
  readonly transport?: TransportSource
  readonly url?: string
  readonly token?: string
}

type WebSocketCtor = new (url: string) => {
  send(data: string): void
  close(): void
  addEventListener(type: string, listener: (event: unknown) => void): void
  removeEventListener(type: string, listener: (event: unknown) => void): void
}

function withToken(url: string, token?: string): string {
  if (!token) return url
  const u = new URL(url)
  u.searchParams.set("token", token)
  return u.toString()
}

/** Open a browser/Node WebSocket, then wrap it with protocol `wsTransport`. */
function openWebSocketTransport(
  url: string,
  token?: string
): Promise<Transport> {
  const WS = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket
  if (!WS) {
    return Promise.reject(
      new Error("WebSocket is not available in this runtime")
    )
  }

  const socket = new WS(withToken(url, token))
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup()
      resolve(wsTransport(socket))
    }
    const onError = () => {
      cleanup()
      reject(new Error("WebSocket failed to open"))
    }
    const cleanup = () => {
      socket.removeEventListener("open", onOpen)
      socket.removeEventListener("error", onError)
    }
    socket.addEventListener("open", onOpen)
    socket.addEventListener("error", onError)
  })
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

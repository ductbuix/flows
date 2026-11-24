import {
  messagePortTransport,
  wsTransport,
  type JsonRpcMessage,
  type MessagePortLike,
  type Transport,
} from "@workspace/protocol"
import { WebSocket } from "ws"

function withToken(url: string, token: string): string {
  const u = new URL(url)
  u.searchParams.set("token", token)
  return u.toString()
}

/**
 * Pipe renderer MessagePort FCP to a daemon WebSocket (desktop attach; DES-039).
 * Buffers local messages until the socket opens.
 */
export function bridgePortToWebSocket(
  port: MessagePortLike,
  url: string,
  token: string
): { dispose: () => void } {
  const local = messagePortTransport(port)
  const pending: JsonRpcMessage[] = []
  let remote: Transport | undefined
  let disposed = false

  const dispose = () => {
    if (disposed) return
    disposed = true
    local.close()
    remote?.close()
    try {
      socket.close()
    } catch {
      // already closed
    }
  }

  const socket = new WebSocket(withToken(url, token))

  local.onMessage((msg) => {
    if (remote) remote.send(msg)
    else pending.push(msg)
  })
  local.onClose(() => dispose())

  socket.addEventListener("open", () => {
    if (disposed) return
    remote = wsTransport(socket)
    for (const msg of pending.splice(0)) remote.send(msg)
    remote.onMessage((msg) => local.send(msg))
    remote.onClose(() => dispose())
  })
  socket.addEventListener("error", () => dispose())
  socket.addEventListener("close", () => dispose())

  return { dispose }
}

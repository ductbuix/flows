import type { JsonRpcMessage } from "@workspace/protocol"
import type { Transport } from "@workspace/protocol"

type BrowserWebSocket = {
  readonly readyState: number
  send(data: string): void
  close(): void
  addEventListener(
    type: "message" | "close" | "error" | "open",
    listener: (ev: { data?: unknown; code?: number; reason?: string }) => void
  ): void
  removeEventListener(
    type: "message" | "close" | "error" | "open",
    listener: (ev: { data?: unknown; code?: number; reason?: string }) => void
  ): void
}

type WebSocketCtor = new (url: string) => BrowserWebSocket

const OPEN = 1

function withToken(url: string, token?: string): string {
  if (!token) return url
  const u = new URL(url)
  u.searchParams.set("token", token)
  return u.toString()
}

/** Minimal WebSocket Transport for `createClient({ url })` until BL-108 lands. */
export function openWebSocketTransport(
  url: string,
  token?: string
): Promise<Transport> {
  const WS = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket
  if (!WS) {
    return Promise.reject(
      new Error("WebSocket is not available in this runtime")
    )
  }

  const ws = new WS(withToken(url, token))
  const messageListeners = new Set<(msg: JsonRpcMessage) => void>()
  const closeListeners = new Set<(err?: Error) => void>()
  let closed = false

  const transport: Transport = {
    send(msg) {
      if (closed || ws.readyState !== OPEN) return
      ws.send(JSON.stringify(msg))
    },
    onMessage(fn) {
      messageListeners.add(fn)
      return () => messageListeners.delete(fn)
    },
    onClose(fn) {
      closeListeners.add(fn)
      return () => closeListeners.delete(fn)
    },
    close() {
      if (closed) return
      closed = true
      ws.close()
    },
  }

  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanupOpen()
      resolve(transport)
    }
    const onError = () => {
      cleanupOpen()
      reject(new Error("WebSocket failed to open"))
    }
    const cleanupOpen = () => {
      ws.removeEventListener("open", onOpen)
      ws.removeEventListener("error", onError)
    }

    ws.addEventListener("open", onOpen)
    ws.addEventListener("error", onError)
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string") return
      try {
        const msg = JSON.parse(ev.data) as JsonRpcMessage
        for (const fn of messageListeners) fn(msg)
      } catch {
        // ignore malformed frames
      }
    })
    ws.addEventListener("close", () => {
      if (closed) {
        for (const fn of closeListeners) fn()
        return
      }
      closed = true
      for (const fn of closeListeners) fn(new Error("WebSocket closed"))
    })
  })
}

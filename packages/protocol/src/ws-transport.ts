import type { JsonRpcMessage } from "./json-rpc.ts"
import type { Transport } from "./transport.ts"

/** Minimal WebSocket surface shared by browser `WebSocket` and the `ws` package. */
export type WsLike = {
  send(data: string): void
  close(): void
  addEventListener(type: string, listener: (event: unknown) => void): void
  removeEventListener(type: string, listener: (event: unknown) => void): void
}

function isBinaryFrame(data: unknown): boolean {
  return typeof data !== "string"
}

function eventError(event: unknown): Error {
  if (event instanceof Error) return event
  if (
    event &&
    typeof event === "object" &&
    "error" in event &&
    (event as { error: unknown }).error instanceof Error
  ) {
    return (event as { error: Error }).error
  }
  if (
    event &&
    typeof event === "object" &&
    "message" in event &&
    typeof (event as { message: unknown }).message === "string" &&
    (event as { message: string }).message.length > 0
  ) {
    return new Error((event as { message: string }).message)
  }
  return new Error("WebSocket error")
}

/** One JSON text frame per message over a browser or Node WebSocket. */
export function wsTransport(socket: WsLike): Transport {
  const messageListeners = new Set<(msg: JsonRpcMessage) => void>()
  const closeListeners = new Set<(err?: Error) => void>()
  let closed = false
  let closeErr: Error | undefined

  const finishClose = (err?: Error) => {
    if (closed) return
    closed = true
    const reason = err ?? closeErr
    socket.removeEventListener("message", onMessage)
    socket.removeEventListener("error", onError)
    socket.removeEventListener("close", onSocketClose)
    for (const fn of closeListeners) fn(reason)
  }

  const onMessage = (event: unknown) => {
    if (closed) return
    const data =
      event && typeof event === "object" && "data" in event
        ? (event as { data: unknown }).data
        : undefined
    if (isBinaryFrame(data)) {
      console.error("wsTransport: binary frame rejected")
      return
    }
    try {
      const msg = JSON.parse(data as string) as JsonRpcMessage
      for (const fn of messageListeners) fn(msg)
    } catch (err) {
      console.error("wsTransport: text frame parse failed", err)
    }
  }

  const onError = (event: unknown) => {
    closeErr = eventError(event)
  }

  const onSocketClose = () => {
    finishClose()
  }

  socket.addEventListener("message", onMessage)
  socket.addEventListener("error", onError)
  socket.addEventListener("close", onSocketClose)

  return {
    send(msg) {
      if (closed) return
      socket.send(JSON.stringify(msg))
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
      socket.close()
    },
  }
}

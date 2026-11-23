import type { JsonRpcMessage } from "./json-rpc.ts"
import type { Transport } from "./transport.ts"

/**
 * Minimal MessagePort surface shared by DOM `MessagePort`, Electron
 * `MessagePortMain`, and `node:worker_threads` `MessagePort`.
 */
export type MessagePortLike = {
  postMessage(message: unknown): void
  close(): void
  start?: () => void
  addEventListener?: (type: string, listener: (event: unknown) => void) => void
  removeEventListener?: (
    type: string,
    listener: (event: unknown) => void
  ) => void
  on?: (type: string, listener: (event: unknown) => void) => unknown
  off?: (type: string, listener: (event: unknown) => void) => unknown
}

function listen(
  port: MessagePortLike,
  type: string,
  listener: (event: unknown) => void
): () => void {
  if (typeof port.addEventListener === "function") {
    port.addEventListener(type, listener)
    return () => port.removeEventListener?.(type, listener)
  }
  if (typeof port.on === "function") {
    port.on(type, listener)
    return () => {
      port.off?.(type, listener)
    }
  }
  throw new Error("messagePortTransport: port cannot listen for events")
}

/** Unwrap MessageEvent / Electron message event; Node EventEmitter may pass the value directly. */
function payload(event: unknown): unknown {
  if (event !== null && typeof event === "object" && "data" in event) {
    return (event as { data: unknown }).data
  }
  return event
}

/** Structured-clone framing over a MessagePort (no JSON string round trip). */
export function messagePortTransport(port: MessagePortLike): Transport {
  const messageListeners = new Set<(msg: JsonRpcMessage) => void>()
  const closeListeners = new Set<(err?: Error) => void>()
  let closed = false
  const unsubscribers: Array<() => void> = []

  const finishClose = (err?: Error) => {
    if (closed) return
    closed = true
    for (const unsub of unsubscribers.splice(0)) unsub()
    for (const fn of closeListeners) fn(err)
  }

  const onMessage = (event: unknown) => {
    if (closed) return
    const msg = payload(event) as JsonRpcMessage
    for (const fn of messageListeners) fn(msg)
  }

  const onPortClose = () => {
    finishClose()
  }

  unsubscribers.push(listen(port, "message", onMessage))
  unsubscribers.push(listen(port, "close", onPortClose))
  port.start?.()

  return {
    send(msg) {
      if (closed) return
      port.postMessage(msg)
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
      port.close()
      // Platforms that do not emit `close` for a local close still need onClose.
      finishClose()
    },
  }
}

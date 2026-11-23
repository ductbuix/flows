import type { JsonRpcMessage } from "./json-rpc.ts"
import type { Transport } from "./transport.ts"

type LinkedHalf = {
  messageListeners: Set<(msg: JsonRpcMessage) => void>
  closeListeners: Set<(err?: Error) => void>
  closed: boolean
  other?: LinkedHalf
}

function closeBoth(self: LinkedHalf, err?: Error) {
  if (self.closed) return
  self.closed = true
  const other = self.other
  if (other && !other.closed) other.closed = true
  for (const fn of self.closeListeners) fn(err)
  if (other) {
    for (const fn of other.closeListeners) fn(err)
  }
}

function makeTransport(self: LinkedHalf): Transport {
  return {
    send(msg) {
      if (self.closed || !self.other) return
      const other = self.other
      void Promise.resolve().then(() => {
        if (other.closed) return
        for (const fn of other.messageListeners) fn(msg)
      })
    },
    onMessage(fn) {
      self.messageListeners.add(fn)
      return () => self.messageListeners.delete(fn)
    },
    onClose(fn) {
      self.closeListeners.add(fn)
      return () => self.closeListeners.delete(fn)
    },
    close() {
      closeBoth(self)
    },
  }
}

/** In-memory transport pair for tests (async microtask hop per DES-040). */
export function createLinkedTransports(): [Transport, Transport] {
  const a: LinkedHalf = {
    messageListeners: new Set(),
    closeListeners: new Set(),
    closed: false,
  }
  const b: LinkedHalf = {
    messageListeners: new Set(),
    closeListeners: new Set(),
    closed: false,
  }
  a.other = b
  b.other = a
  return [makeTransport(a), makeTransport(b)]
}

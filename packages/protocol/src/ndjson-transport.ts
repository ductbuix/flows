import type { Readable, Writable } from "node:stream"
import type { JsonRpcMessage } from "./json-rpc.ts"
import type { Transport } from "./transport.ts"

export type NdjsonTransport = Transport & {
  onError(fn: (err: Error) => void): () => void
}

/**
 * One JSON message per line over a readable/writable stream pair
 * (stdio peers: ACP agents, `flows engine --stdio`).
 */
export function ndjsonTransport(
  readable: Readable,
  writable: Writable
): NdjsonTransport {
  const messageListeners = new Set<(msg: JsonRpcMessage) => void>()
  const closeListeners = new Set<(err?: Error) => void>()
  const errorListeners = new Set<(err: Error) => void>()
  let closed = false
  let closeErr: Error | undefined
  let buffer = ""

  const finishClose = (err?: Error) => {
    if (closed) return
    closed = true
    const reason = err ?? closeErr
    readable.off("data", onData)
    readable.off("end", onEnd)
    readable.off("error", onReadableError)
    writable.off("error", onWritableError)
    for (const fn of closeListeners) fn(reason)
  }

  const emitError = (err: Error) => {
    for (const fn of errorListeners) fn(err)
  }

  const handleLine = (line: string) => {
    if (line.length === 0) return
    try {
      const msg = JSON.parse(line) as JsonRpcMessage
      for (const fn of messageListeners) fn(msg)
    } catch (cause) {
      const err =
        cause instanceof Error
          ? new Error(`ndjsonTransport: malformed line: ${cause.message}`, {
              cause,
            })
          : new Error("ndjsonTransport: malformed line")
      emitError(err)
    }
  }

  const onData = (chunk: unknown) => {
    if (closed) return
    buffer +=
      typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8")
    let nl = buffer.indexOf("\n")
    while (nl !== -1) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      // Tolerate CRLF from peers that write \r\n.
      handleLine(line.endsWith("\r") ? line.slice(0, -1) : line)
      nl = buffer.indexOf("\n")
    }
  }

  const onEnd = () => {
    if (buffer.length > 0) {
      handleLine(buffer)
      buffer = ""
    }
    finishClose()
  }

  const onReadableError = (err: Error) => {
    closeErr = err
    finishClose(err)
  }

  const onWritableError = (err: Error) => {
    closeErr = err
    finishClose(err)
  }

  readable.on("data", onData)
  readable.on("end", onEnd)
  readable.on("error", onReadableError)
  writable.on("error", onWritableError)

  return {
    send(msg) {
      if (closed) return
      writable.write(`${JSON.stringify(msg)}\n`)
    },
    onMessage(fn) {
      messageListeners.add(fn)
      return () => messageListeners.delete(fn)
    },
    onClose(fn) {
      closeListeners.add(fn)
      return () => closeListeners.delete(fn)
    },
    onError(fn) {
      errorListeners.add(fn)
      return () => errorListeners.delete(fn)
    },
    close() {
      if (closed) return
      finishClose()
      readable.destroy()
      if (!writable.writableEnded) writable.end()
    },
  }
}

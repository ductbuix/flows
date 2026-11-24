import type { DocumentStore } from "@workspace/core"
import type { JsonRpcMessage, Transport } from "@workspace/protocol"

export const REDACTED = "[REDACTED]"

export type AcpLogSink = {
  append(line: string): void
}

/** Append-only sink for `runs/<id>/steps/<step>/acp.ndjson` via DocumentStore. */
export function documentStoreAcpSink(
  docs: DocumentStore,
  path: string
): AcpLogSink {
  return {
    append(line) {
      const prev = docs.read(path)?.text ?? ""
      const next = prev.length === 0 ? `${line}\n` : `${prev}${line}\n`
      docs.write(path, next)
    },
  }
}

/** Replace known secret substrings in any JSON-compatible value. */
export function redactSecrets(
  value: unknown,
  secrets: readonly string[]
): unknown {
  if (secrets.length === 0) return value
  const live = secrets.filter((s) => s.length > 0)
  if (live.length === 0) return value
  return walk(value, live)
}

function walk(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === "string") return redactString(value, secrets)
  if (Array.isArray(value)) return value.map((v) => walk(v, secrets))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v, secrets)
    }
    return out
  }
  return value
}

function redactString(text: string, secrets: readonly string[]): string {
  let out = text
  for (const secret of secrets) {
    if (secret && out.includes(secret)) {
      out = out.split(secret).join(REDACTED)
    }
  }
  return out
}

export function logAcpMessage(
  sink: AcpLogSink,
  message: JsonRpcMessage,
  secrets: readonly string[] = []
): void {
  const redacted = redactSecrets(message, secrets) as JsonRpcMessage
  sink.append(JSON.stringify(redacted))
}

/**
 * Wrap a transport so every inbound and outbound JSON-RPC message is
 * appended to the ACP log (DES-042).
 */
export function loggingTransport(
  inner: Transport,
  sink: AcpLogSink,
  secrets: readonly string[] = []
): Transport {
  return {
    send(msg) {
      logAcpMessage(sink, msg, secrets)
      inner.send(msg)
    },
    onMessage(fn) {
      return inner.onMessage((msg) => {
        logAcpMessage(sink, msg, secrets)
        fn(msg)
      })
    },
    onClose(fn) {
      return inner.onClose(fn)
    },
    close() {
      inner.close()
    },
  }
}

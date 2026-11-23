import type { JsonRpcMessage } from "./json-rpc.ts"

export type Transport = {
  send(msg: JsonRpcMessage): void
  onMessage(fn: (msg: JsonRpcMessage) => void): () => void
  onClose(fn: (err?: Error) => void): () => void
  close(): void
}

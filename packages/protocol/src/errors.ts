import { JSONRPC_INTERNAL_ERROR, type JsonRpcErrorObject } from "./json-rpc.ts"

export class JsonRpcResponseError extends Error {
  readonly code: number
  readonly data?: unknown

  constructor(error: JsonRpcErrorObject) {
    super(error.message)
    this.name = "JsonRpcResponseError"
    this.code = error.code
    this.data = error.data
  }
}

export class TransportClosedError extends Error {
  constructor(cause?: Error) {
    super(cause?.message ?? "transport closed")
    this.name = "TransportClosedError"
  }
}

/** Map a thrown value to a JSON-RPC error object for responses. */
export function toJsonRpcError(thrown: unknown): JsonRpcErrorObject {
  if (thrown instanceof JsonRpcResponseError) {
    return {
      code: thrown.code,
      message: thrown.message,
      ...(thrown.data !== undefined ? { data: thrown.data } : {}),
    }
  }
  if (thrown instanceof Error) {
    return { code: JSONRPC_INTERNAL_ERROR, message: thrown.message }
  }
  return { code: JSONRPC_INTERNAL_ERROR, message: String(thrown) }
}

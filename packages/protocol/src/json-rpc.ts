export const JSONRPC_VERSION = "2.0" as const

export type JsonRpcId = string | number

export type JsonRpcErrorObject = {
  code: number
  message: string
  data?: unknown
}

export type JsonRpcRequest = {
  jsonrpc: typeof JSONRPC_VERSION
  method: string
  params?: unknown
  id: JsonRpcId
}

export type JsonRpcNotification = {
  jsonrpc: typeof JSONRPC_VERSION
  method: string
  params?: unknown
}

export type JsonRpcSuccess = {
  jsonrpc: typeof JSONRPC_VERSION
  result: unknown
  id: JsonRpcId | null
}

export type JsonRpcFailure = {
  jsonrpc: typeof JSONRPC_VERSION
  error: JsonRpcErrorObject
  id: JsonRpcId | null
}

export type JsonRpcMessage =
  JsonRpcRequest | JsonRpcNotification | JsonRpcSuccess | JsonRpcFailure

export const JSONRPC_PARSE_ERROR = -32700
export const JSONRPC_INVALID_REQUEST = -32600
export const JSONRPC_METHOD_NOT_FOUND = -32601
export const JSONRPC_INVALID_PARAMS = -32602
export const JSONRPC_INTERNAL_ERROR = -32603
/** Request cancelled by `$/cancel_request` (DES-040). */
export const JSONRPC_REQUEST_CANCELLED = -32800

export function isJsonRpcRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return (
    msg.jsonrpc === JSONRPC_VERSION &&
    "method" in msg &&
    "id" in msg &&
    msg.id !== undefined &&
    msg.id !== null
  )
}

export function isJsonRpcNotification(
  msg: JsonRpcMessage
): msg is JsonRpcNotification {
  return msg.jsonrpc === JSONRPC_VERSION && "method" in msg && !("id" in msg)
}

export function isJsonRpcResponse(
  msg: JsonRpcMessage
): msg is JsonRpcSuccess | JsonRpcFailure {
  return (
    msg.jsonrpc === JSONRPC_VERSION &&
    ("result" in msg || "error" in msg) &&
    "id" in msg
  )
}

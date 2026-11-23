import {
  JSONRPC_REQUEST_CANCELLED,
  type JsonRpcErrorObject,
  type JsonRpcId,
} from "./json-rpc.ts"

/** Notification a peer sends to abort a pending request (DES-040). */
export const CANCEL_REQUEST_METHOD = "$/cancel_request"

export type RequestContext = {
  readonly signal: AbortSignal
}

export type RequestOptions = {
  readonly signal?: AbortSignal
}

export function cancelledErrorObject(
  message = "Request cancelled"
): JsonRpcErrorObject {
  return {
    code: JSONRPC_REQUEST_CANCELLED,
    message,
    data: { code: "cancelled" },
  }
}

/** Read `{ id }` from a `$/cancel_request` notification; undefined if invalid. */
export function cancelRequestId(params: unknown): JsonRpcId | undefined {
  if (params === null || typeof params !== "object") return undefined
  const id = (params as { id?: unknown }).id
  if (typeof id === "string" || typeof id === "number") return id
  return undefined
}

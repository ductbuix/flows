import {
  CANCEL_REQUEST_METHOD,
  cancelRequestId,
  cancelledErrorObject,
} from "./cancel.ts"
import {
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_VERSION,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  type JsonRpcId,
  type JsonRpcMessage,
  type JsonRpcNotification,
  type JsonRpcRequest,
} from "./json-rpc.ts"
import { JsonRpcResponseError, toJsonRpcError } from "./errors.ts"
import type { Transport } from "./transport.ts"
import type { NotificationHandler, RequestHandler } from "./rpc-peer-types.ts"

export type Inflight = {
  controller: AbortController
  done: boolean
}

export type InboundState = {
  transport: Transport
  requestHandlers: Map<string, RequestHandler>
  notificationHandlers: Map<string, NotificationHandler>
  inflight: Map<JsonRpcId, Inflight>
  cancelledIds: Set<JsonRpcId>
  pending: Map<
    JsonRpcId,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    }
  >
}

export async function handleInboundMessage(
  state: InboundState,
  msg: JsonRpcMessage
): Promise<void> {
  if (isJsonRpcResponse(msg)) {
    const wait = msg.id !== null ? state.pending.get(msg.id) : undefined
    if (!wait) return
    state.pending.delete(msg.id as JsonRpcId)
    if ("error" in msg && msg.error) {
      wait.reject(new JsonRpcResponseError(msg.error))
      return
    }
    if ("result" in msg) {
      wait.resolve(msg.result)
    }
    return
  }

  if (isJsonRpcRequest(msg)) {
    await handleRequest(state, msg)
    return
  }

  if (isJsonRpcNotification(msg)) {
    await handleNotification(state, msg)
  }
}

async function handleRequest(
  state: InboundState,
  msg: JsonRpcRequest
): Promise<void> {
  if (state.cancelledIds.has(msg.id)) {
    state.cancelledIds.delete(msg.id)
    state.transport.send({
      jsonrpc: JSONRPC_VERSION,
      error: cancelledErrorObject(),
      id: msg.id,
    })
    return
  }

  const handler = state.requestHandlers.get(msg.method)
  if (!handler) {
    state.transport.send({
      jsonrpc: JSONRPC_VERSION,
      error: {
        code: JSONRPC_METHOD_NOT_FOUND,
        message: `Method not found: ${msg.method}`,
      },
      id: msg.id,
    })
    return
  }

  const entry: Inflight = { controller: new AbortController(), done: false }
  state.inflight.set(msg.id, entry)

  const respond = (response: JsonRpcMessage) => {
    if (entry.done) return
    entry.done = true
    state.inflight.delete(msg.id)
    state.transport.send(response)
  }

  try {
    const result = await handler(msg.params, {
      signal: entry.controller.signal,
    })
    respond({
      jsonrpc: JSONRPC_VERSION,
      result: result ?? null,
      id: msg.id,
    })
  } catch (thrown) {
    if (entry.controller.signal.aborted) {
      respond({
        jsonrpc: JSONRPC_VERSION,
        error: cancelledErrorObject(),
        id: msg.id,
      })
      return
    }
    respond({
      jsonrpc: JSONRPC_VERSION,
      error: toJsonRpcError(thrown),
      id: msg.id,
    })
  }
}

async function handleNotification(
  state: InboundState,
  msg: JsonRpcNotification
): Promise<void> {
  if (msg.method === CANCEL_REQUEST_METHOD) {
    honourCancel(state, cancelRequestId(msg.params))
    return
  }
  const handler = state.notificationHandlers.get(msg.method)
  if (!handler) return
  try {
    await handler(msg.params)
  } catch {
    // Notifications have no response; swallow handler errors.
  }
}

function honourCancel(state: InboundState, id: JsonRpcId | undefined): void {
  if (id === undefined) return
  const entry = state.inflight.get(id)
  if (!entry) {
    state.cancelledIds.add(id)
    return
  }
  if (entry.done) return
  entry.controller.abort()
  entry.done = true
  state.inflight.delete(id)
  state.transport.send({
    jsonrpc: JSONRPC_VERSION,
    error: cancelledErrorObject(),
    id,
  })
}

import {
  CANCEL_REQUEST_METHOD,
  cancelledErrorObject,
  type RequestOptions,
} from "./cancel.ts"
import {
  JSONRPC_VERSION,
  type JsonRpcId,
  type JsonRpcMessage,
} from "./json-rpc.ts"
import { JsonRpcResponseError, TransportClosedError } from "./errors.ts"
import {
  handleInboundMessage,
  type Inflight,
  type InboundState,
} from "./rpc-inbound.ts"
import type { NotificationHandler, RequestHandler } from "./rpc-peer-types.ts"
import type { Transport } from "./transport.ts"

export type { RequestContext, RequestOptions } from "./cancel.ts"
export type { NotificationHandler, RequestHandler } from "./rpc-peer-types.ts"

export class RpcPeer {
  private nextId = 1
  private readonly pending = new Map<
    JsonRpcId,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    }
  >()
  private readonly inflight = new Map<JsonRpcId, Inflight>()
  private readonly cancelledIds = new Set<JsonRpcId>()
  private readonly requestHandlers = new Map<string, RequestHandler>()
  private readonly notificationHandlers = new Map<string, NotificationHandler>()
  private readonly unsubs: (() => void)[] = []
  private readonly inbound: InboundState
  private readonly transport: Transport
  private closed = false

  constructor(transport: Transport) {
    this.transport = transport
    this.inbound = {
      transport,
      requestHandlers: this.requestHandlers,
      notificationHandlers: this.notificationHandlers,
      inflight: this.inflight,
      cancelledIds: this.cancelledIds,
      pending: this.pending,
    }
    this.unsubs.push(
      transport.onMessage((msg) => {
        void handleInboundMessage(this.inbound, msg)
      })
    )
    this.unsubs.push(
      transport.onClose((err) => {
        this.rejectPending(new TransportClosedError(err))
        this.closed = true
      })
    )
  }

  request(
    method: string,
    params?: unknown,
    options?: RequestOptions
  ): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new TransportClosedError())
    }
    const id = this.nextId++
    const msg: JsonRpcMessage = {
      jsonrpc: JSONRPC_VERSION,
      method,
      ...(params !== undefined ? { params } : {}),
      id,
    }
    return new Promise((resolve, reject) => {
      const signal = options?.signal
      let onAbort: (() => void) | undefined

      const clearAbort = () => {
        if (onAbort && signal) signal.removeEventListener("abort", onAbort)
        onAbort = undefined
      }

      this.pending.set(id, {
        resolve: (value) => {
          clearAbort()
          resolve(value)
        },
        reject: (error) => {
          clearAbort()
          reject(error)
        },
      })

      onAbort = () => {
        this.notify(CANCEL_REQUEST_METHOD, { id })
        const wait = this.pending.get(id)
        if (!wait) return
        this.pending.delete(id)
        wait.reject(new JsonRpcResponseError(cancelledErrorObject()))
      }

      if (signal) {
        if (signal.aborted) {
          this.transport.send(msg)
          onAbort()
          return
        }
        signal.addEventListener("abort", onAbort)
      }

      this.transport.send(msg)
    })
  }

  notify(method: string, params?: unknown): void {
    if (this.closed) return
    const msg: JsonRpcMessage = {
      jsonrpc: JSONRPC_VERSION,
      method,
      ...(params !== undefined ? { params } : {}),
    }
    this.transport.send(msg)
  }

  onRequest(method: string, handler: RequestHandler): () => void {
    this.requestHandlers.set(method, handler)
    return () => {
      this.requestHandlers.delete(method)
    }
  }

  onNotification(method: string, handler: NotificationHandler): () => void {
    this.notificationHandlers.set(method, handler)
    return () => {
      this.notificationHandlers.delete(method)
    }
  }

  close(): void {
    if (this.closed) return
    this.transport.close()
  }

  dispose(): void {
    for (const unsub of this.unsubs) unsub()
    this.unsubs.length = 0
    this.requestHandlers.clear()
    this.notificationHandlers.clear()
    for (const entry of this.inflight.values()) {
      entry.controller.abort()
    }
    this.inflight.clear()
    this.cancelledIds.clear()
    this.rejectPending(new TransportClosedError())
  }

  private rejectPending(err: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(err)
    }
    this.pending.clear()
    this.closed = true
  }
}

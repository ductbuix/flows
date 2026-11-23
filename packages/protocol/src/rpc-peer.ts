import {
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_VERSION,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  type JsonRpcId,
  type JsonRpcMessage,
} from "./json-rpc.ts"
import {
  JsonRpcResponseError,
  TransportClosedError,
  toJsonRpcError,
} from "./errors.ts"
import type { Transport } from "./transport.ts"

export type RequestHandler = (params: unknown) => unknown | Promise<unknown>

export type NotificationHandler = (params: unknown) => void | Promise<void>

export class RpcPeer {
  private nextId = 1
  private readonly pending = new Map<
    JsonRpcId,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    }
  >()
  private readonly requestHandlers = new Map<string, RequestHandler>()
  private readonly notificationHandlers = new Map<string, NotificationHandler>()
  private readonly unsubs: (() => void)[] = []
  private closed = false

  constructor(private readonly transport: Transport) {
    this.unsubs.push(
      transport.onMessage((msg) => {
        void this.handleMessage(msg)
      })
    )
    this.unsubs.push(
      transport.onClose((err) => {
        this.rejectPending(new TransportClosedError(err))
        this.closed = true
      })
    )
  }

  request(method: string, params?: unknown): Promise<unknown> {
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
      this.pending.set(id, { resolve, reject })
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
    this.rejectPending(new TransportClosedError())
  }

  private rejectPending(err: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(err)
    }
    this.pending.clear()
    this.closed = true
  }

  private async handleMessage(msg: JsonRpcMessage): Promise<void> {
    if (isJsonRpcResponse(msg)) {
      const wait = msg.id !== null ? this.pending.get(msg.id) : undefined
      if (!wait) return
      this.pending.delete(msg.id as JsonRpcId)
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
      const handler = this.requestHandlers.get(msg.method)
      if (!handler) {
        this.transport.send({
          jsonrpc: JSONRPC_VERSION,
          error: {
            code: JSONRPC_METHOD_NOT_FOUND,
            message: `Method not found: ${msg.method}`,
          },
          id: msg.id,
        })
        return
      }
      try {
        const result = await handler(msg.params)
        this.transport.send({
          jsonrpc: JSONRPC_VERSION,
          result: result ?? null,
          id: msg.id,
        })
      } catch (thrown) {
        this.transport.send({
          jsonrpc: JSONRPC_VERSION,
          error: toJsonRpcError(thrown),
          id: msg.id,
        })
      }
      return
    }

    if (isJsonRpcNotification(msg)) {
      const handler = this.notificationHandlers.get(msg.method)
      if (!handler) return
      try {
        await handler(msg.params)
      } catch {
        // Notifications have no response; swallow handler errors.
      }
    }
  }
}

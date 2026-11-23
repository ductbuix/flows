import { fcpMethodTable } from "@workspace/contracts"
import {
  RpcPeer,
  TransportClosedError,
  type Transport,
} from "@workspace/protocol"
import { createBackoff, sleep } from "./backoff.ts"
import { resolveConnect } from "./connect.ts"
import {
  asRetryable,
  ProtocolVersionError,
  RetryableConnectionError,
} from "./errors.ts"
import type { ClientInfo, InitializeResult } from "./initialize.ts"
import { openSession } from "./session.ts"
import type {
  CreateClientOptions,
  FlowsClient,
  FcpMethodName,
} from "./types.ts"

export type {
  CreateClientOptions,
  FlowsClient,
  FcpMethodName,
  FcpNotificationName,
} from "./types.ts"

type QueuedCall = {
  method: string
  params: unknown
  resolve: (value: unknown) => void
  reject: (err: unknown) => void
}

const DEFAULT_CLIENT_INFO: ClientInfo = {
  name: "@workspace/sdk",
  version: "0.0.0",
}

export function createClient(options: CreateClientOptions): FlowsClient {
  const connect = resolveConnect(options)
  const capabilities = options.capabilities ?? {}
  const clientInfo = options.clientInfo ?? DEFAULT_CLIENT_INFO
  const backoff = createBackoff(options.backoff)

  let peer: RpcPeer | undefined
  let transport: Transport | undefined
  let sessionReady = false
  let closedByUser = false
  let settledReady = false
  let reconnecting = false
  const queue: QueuedCall[] = []
  const notificationHandlers = new Map<string, Set<(params: unknown) => void>>()
  const abortReconnect = new AbortController()

  let resolveReady!: (value: InitializeResult) => void
  let rejectReady!: (err: unknown) => void
  const readyPromise = new Promise<InitializeResult>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  function settleReady(result: InitializeResult): void {
    if (settledReady) return
    settledReady = true
    resolveReady(result)
  }

  function failReady(err: unknown): void {
    if (settledReady) return
    settledReady = true
    rejectReady(err)
  }

  async function dispatch(method: string, params: unknown): Promise<unknown> {
    if (!peer || !sessionReady) {
      return new Promise((resolve, reject) => {
        queue.push({ method, params, resolve, reject })
      })
    }
    const def = fcpMethodTable[method as FcpMethodName]
    const parsed = def.params.safeParse(params ?? {})
    if (!parsed.success) throw parsed.error
    try {
      return def.result.parse(await peer.request(method, parsed.data))
    } catch (err) {
      if (err instanceof TransportClosedError) throw asRetryable(err)
      throw err
    }
  }

  function flushQueue(): void {
    const pending = queue.splice(0, queue.length)
    for (const item of pending) {
      void dispatch(item.method, item.params).then(item.resolve, item.reject)
    }
  }

  async function startSession(): Promise<InitializeResult> {
    const session = await openSession(
      connect,
      clientInfo,
      capabilities,
      {
        notificationHandlers,
        onDrop: () => {
          peer = undefined
          transport = undefined
          sessionReady = false
          void ensureReconnect()
        },
      },
      () => closedByUser
    )
    peer = session.peer
    transport = session.transport
    sessionReady = true
    backoff.reset()
    flushQueue()
    return session.initialize
  }

  async function ensureReconnect(): Promise<void> {
    if (closedByUser || reconnecting) return
    reconnecting = true
    try {
      while (!closedByUser) {
        try {
          await sleep(backoff.nextDelayMs(), abortReconnect.signal)
          if (closedByUser) return
          settleReady(await startSession())
          return
        } catch (err) {
          if (closedByUser) return
          if (err instanceof ProtocolVersionError) {
            failReady(err)
            return
          }
        }
      }
    } finally {
      reconnecting = false
    }
  }

  void startSession()
    .then(settleReady)
    .catch((err) => {
      if (closedByUser) return
      if (err instanceof ProtocolVersionError) {
        failReady(err)
        return
      }
      void ensureReconnect()
    })

  return {
    ready: readyPromise,
    call(method, params) {
      return dispatch(method, params) as Promise<never>
    },
    onNotification(method, handler) {
      let set = notificationHandlers.get(method)
      if (!set) {
        set = new Set()
        notificationHandlers.set(method, set)
        peer?.onNotification(method, (params) => {
          for (const h of notificationHandlers.get(method) ?? []) h(params)
        })
      }
      const wrapped = handler as (params: unknown) => void
      set.add(wrapped)
      return () => {
        set?.delete(wrapped)
      }
    },
    close() {
      closedByUser = true
      abortReconnect.abort()
      sessionReady = false
      for (const item of queue) {
        item.reject(new RetryableConnectionError("client closed"))
      }
      queue.length = 0
      failReady(new RetryableConnectionError("client closed"))
      peer?.dispose()
      peer = undefined
      transport?.close()
      transport = undefined
    },
  }
}

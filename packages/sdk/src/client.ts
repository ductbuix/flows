import { type RpcPeer, type Transport } from "@workspace/protocol"
import { createBackoff, sleep } from "./backoff.ts"
import { createClientCalls } from "./calls.ts"
import { resolveConnect } from "./connect.ts"
import { ProtocolVersionError, RetryableConnectionError } from "./errors.ts"
import type { ClientInfo, InitializeResult } from "./initialize.ts"
import { deliverNotification, openSession } from "./session.ts"
import { createSubscriptionTracker } from "./subscriptions.ts"
import type {
  ClientEventMap,
  CreateClientOptions,
  FlowsClient,
} from "./types.ts"

export type {
  ClientEventMap,
  CreateClientOptions,
  FlowsClient,
  FcpMethodName,
  FcpNotificationName,
} from "./types.ts"

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
  const notificationHandlers = new Map<string, Set<(params: unknown) => void>>()
  const resyncHandlers = new Set<(topic: string) => void>()
  const abortReconnect = new AbortController()
  const subscriptions = createSubscriptionTracker((topic) => {
    for (const handler of resyncHandlers) handler(topic)
  })
  const calls = createClientCalls(
    { getPeer: () => peer, isReady: () => sessionReady },
    subscriptions
  )
  const sessionHooks = {
    notificationHandlers,
    onNotify(_method: string, params: unknown) {
      subscriptions.noteParamsSeq(params)
    },
    onDrop: () => {
      peer = undefined
      transport = undefined
      sessionReady = false
      void ensureReconnect()
    },
  }

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

  async function startSession(): Promise<InitializeResult> {
    const session = await openSession(
      connect,
      clientInfo,
      capabilities,
      sessionHooks,
      () => closedByUser
    )
    peer = session.peer
    transport = session.transport
    sessionReady = true
    backoff.reset()
    await calls.resubscribe()
    calls.flushQueue()
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
      return calls.dispatch(method, params) as Promise<never>
    },
    onNotification(method, handler) {
      let set = notificationHandlers.get(method)
      if (!set) {
        set = new Set()
        notificationHandlers.set(method, set)
        peer?.onNotification(method, (params) => {
          deliverNotification(sessionHooks, method, params)
        })
      }
      const wrapped = handler as (params: unknown) => void
      set.add(wrapped)
      return () => {
        set?.delete(wrapped)
      }
    },
    on(event, handler) {
      if (event !== "resync") {
        throw new Error(`unknown client event: ${String(event)}`)
      }
      const h = handler as ClientEventMap["resync"]
      resyncHandlers.add(h)
      return () => {
        resyncHandlers.delete(h)
      }
    },
    close() {
      closedByUser = true
      abortReconnect.abort()
      sessionReady = false
      calls.rejectQueue(new RetryableConnectionError("client closed"))
      failReady(new RetryableConnectionError("client closed"))
      peer?.dispose()
      peer = undefined
      transport?.close()
      transport = undefined
    },
  }
}

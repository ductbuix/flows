import { fcpMethodTable, subscribeMethod } from "@workspace/contracts"
import { TransportClosedError, type RpcPeer } from "@workspace/protocol"
import { asRetryable } from "./errors.ts"
import type { SubscriptionTracker } from "./subscriptions.ts"
import type { FcpMethodName } from "./types.ts"

type QueuedCall = {
  method: string
  params: unknown
  resolve: (value: unknown) => void
  reject: (err: unknown) => void
}

export type CallGate = {
  getPeer: () => RpcPeer | undefined
  isReady: () => boolean
}

export type ClientCalls = {
  dispatch(method: string, params: unknown): Promise<unknown>
  flushQueue(): void
  resubscribe(): Promise<void>
  rejectQueue(err: unknown): void
}

export function createClientCalls(
  gate: CallGate,
  subscriptions: SubscriptionTracker
): ClientCalls {
  const queue: QueuedCall[] = []

  function trackMethodResult(method: string, params: unknown, result: unknown) {
    if (method === "subscribe") {
      subscriptions.onSubscribe(
        params as Parameters<SubscriptionTracker["onSubscribe"]>[0],
        result as Parameters<SubscriptionTracker["onSubscribe"]>[1]
      )
    } else if (method === "unsubscribe") {
      subscriptions.onUnsubscribe(
        params as Parameters<SubscriptionTracker["onUnsubscribe"]>[0]
      )
    }
  }

  async function dispatch(method: string, params: unknown): Promise<unknown> {
    const peer = gate.getPeer()
    if (!peer || !gate.isReady()) {
      return new Promise((resolve, reject) => {
        queue.push({ method, params, resolve, reject })
      })
    }
    const def = fcpMethodTable[method as FcpMethodName]
    const parsed = def.params.safeParse(params ?? {})
    if (!parsed.success) throw parsed.error
    try {
      const result = def.result.parse(await peer.request(method, parsed.data))
      trackMethodResult(method, parsed.data, result)
      return result
    } catch (err) {
      if (err instanceof TransportClosedError) throw asRetryable(err)
      throw err
    }
  }

  return {
    dispatch,
    flushQueue() {
      const pending = queue.splice(0, queue.length)
      for (const item of pending) {
        void dispatch(item.method, item.params).then(item.resolve, item.reject)
      }
    },
    async resubscribe() {
      const peer = gate.getPeer()
      if (!peer) return
      const params = subscriptions.resubscribeParams()
      if (!params) return
      const parsed = subscribeMethod.params.parse(params)
      const result = subscribeMethod.result.parse(
        await peer.request("subscribe", parsed)
      )
      subscriptions.onSubscribe(parsed, result)
    },
    rejectQueue(err) {
      for (const item of queue) item.reject(err)
      queue.length = 0
    },
  }
}

import type {
  ClientEventMap,
  FcpNotificationName,
  FlowsClient,
} from "@workspace/sdk"

type NotifHandler = (params: unknown) => void
type RequestHandler = (params: unknown) => unknown | Promise<unknown>
type ResyncHandler = ClientEventMap["resync"]

/** In-memory FlowsClient for hook tests. */
export function createFakeClient(options?: {
  call?: (method: string, params: unknown) => Promise<unknown>
}): FlowsClient & {
  emitNotification: (method: string, params: unknown) => void
  emitRequest: (method: string, params: unknown) => Promise<unknown>
  emitResync: (topic: string) => void
  calls: { method: string; params: unknown }[]
} {
  const notificationHandlers = new Map<string, Set<NotifHandler>>()
  const requestHandlers = new Map<string, RequestHandler>()
  const resyncHandlers = new Set<ResyncHandler>()
  const calls: { method: string; params: unknown }[] = []
  const callImpl =
    options?.call ??
    (async () => {
      throw new Error("fake client: no call handler")
    })

  return {
    calls,
    ready: Promise.resolve({
      protocolVersion: 1,
      engineInfo: { name: "fake", version: "0" },
      engineCapabilities: { agents: [], nodeKinds: [] },
      workspace: { home: "/tmp", id: "ws" },
    }),
    call(method, params) {
      calls.push({ method, params })
      return callImpl(method, params) as Promise<never>
    },
    onNotification(method, handler) {
      let set = notificationHandlers.get(method)
      if (!set) {
        set = new Set()
        notificationHandlers.set(method, set)
      }
      const wrapped = handler as NotifHandler
      set.add(wrapped)
      return () => {
        set?.delete(wrapped)
      }
    },
    onRequest(method, handler) {
      const wrapped = handler as RequestHandler
      requestHandlers.set(method, wrapped)
      return () => {
        if (requestHandlers.get(method) === wrapped) {
          requestHandlers.delete(method)
        }
      }
    },
    on(event, handler) {
      if (event !== "resync") {
        throw new Error(`unknown client event: ${String(event)}`)
      }
      const h = handler as ResyncHandler
      resyncHandlers.add(h)
      return () => {
        resyncHandlers.delete(h)
      }
    },
    close() {},
    emitNotification(method: string, params: unknown) {
      const set = notificationHandlers.get(method as FcpNotificationName)
      if (!set) return
      for (const h of set) h(params)
    },
    async emitRequest(method: string, params: unknown) {
      const handler = requestHandlers.get(method)
      if (!handler) throw new Error(`fake client: no handler for ${method}`)
      return handler(params)
    },
    emitResync(topic: string) {
      for (const h of resyncHandlers) h(topic)
    },
  }
}

export type FakeClient = ReturnType<typeof createFakeClient>

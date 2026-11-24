import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@workspace/sdk", () => ({
  createClient: vi.fn((opts: unknown) => ({
    kind: "client",
    opts,
    ready: Promise.resolve({}),
    onRequest: () => () => {},
    onNotification: () => () => {},
    call: async () => ({}),
  })),
}))

vi.mock("@workspace/protocol", () => ({
  messagePortTransport: vi.fn((port: unknown) => ({ kind: "mp", port })),
}))

describe("createAppClient", () => {
  afterEach(() => {
    delete window.flowsDesktop
    delete window.__FLOWS_FCP__
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("uses MessagePort when flowsDesktop.connect is present", async () => {
    const port = { tag: "port" } as unknown as MessagePort
    window.flowsDesktop = {
      connect: () => {
        queueMicrotask(() => {
          const listeners =
            (
              window as unknown as {
                __msg?: Array<(e: MessageEvent) => void>
              }
            ).__msg ?? []
          for (const fn of listeners) {
            fn({
              source: window,
              data: { type: "flows-fcp-local-port" },
              ports: [port],
            } as unknown as MessageEvent)
          }
        })
      },
      revealPath: () => {},
      notifyInboxItem: () => {},
      browserSignIn: async () => ({ cancelled: true as const }),
    }
    const origAdd = window.addEventListener.bind(window)
    const origRemove = window.removeEventListener.bind(window)
    const bag: Array<(e: MessageEvent) => void> = []
    ;(window as unknown as { __msg: Array<(e: MessageEvent) => void> }).__msg =
      bag
    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      if (type === "message" && typeof listener === "function") {
        bag.push(listener as (e: MessageEvent) => void)
      }
      return origAdd(type, listener)
    }) as typeof window.addEventListener
    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      if (type === "message" && typeof listener === "function") {
        const i = bag.indexOf(listener as (e: MessageEvent) => void)
        if (i >= 0) bag.splice(i, 1)
      }
      return origRemove(type, listener)
    }) as typeof window.removeEventListener

    const { createClient } = await import("@workspace/sdk")
    const { messagePortTransport } = await import("@workspace/protocol")
    const { createAppClient } = await import("./create-app-client.ts")

    const client = await createAppClient()
    expect(client).toMatchObject({ kind: "client", opts: expect.any(Object) })
    const opts = (createClient as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as {
      transport: () => Promise<unknown>
      capabilities: {
        host: {
          revealPath: boolean
          notifications: boolean
          browserSignIn: boolean
        }
      }
    }
    expect(opts.capabilities).toEqual({
      host: { revealPath: true, notifications: true, browserSignIn: true },
    })
    await opts.transport()
    expect(messagePortTransport).toHaveBeenCalledWith(port)

    window.addEventListener = origAdd
    window.removeEventListener = origRemove
  })

  it("uses WebSocket url when __FLOWS_FCP__ is present", async () => {
    window.__FLOWS_FCP__ = {
      url: "ws://127.0.0.1:8787/fcp",
      token: "secret",
    }
    const { createClient } = await import("@workspace/sdk")
    const { createAppClient } = await import("./create-app-client.ts")

    await createAppClient()
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "ws://127.0.0.1:8787/fcp",
        token: "secret",
      })
    )
  })

  it("fetches /fcp/bootstrap when embed is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          url: "ws://127.0.0.1:8787/fcp",
          token: "boot",
        })
      )
    )
    const { createClient } = await import("@workspace/sdk")
    const { createAppClient } = await import("./create-app-client.ts")

    await createAppClient()
    expect(fetch).toHaveBeenCalledWith("/fcp/bootstrap")
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "ws://127.0.0.1:8787/fcp",
        token: "boot",
      })
    )
  })

  it("returns null when neither transport is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 403 }))
    )
    const { createAppClient } = await import("./create-app-client.ts")
    expect(await createAppClient()).toBeNull()
  })
})

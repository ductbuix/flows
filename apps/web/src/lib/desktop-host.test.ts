import { afterEach, describe, expect, it, vi } from "vitest"
import type { FlowsClient } from "@workspace/sdk"
import {
  desktopClientCapabilities,
  installDesktopHost,
} from "./desktop-host.ts"

function fakeDesktopClient(): FlowsClient & {
  emitNotification: (method: string, params: unknown) => void
  emitRequest: (method: string, params: unknown) => Promise<unknown>
} {
  const notificationHandlers = new Map<string, Set<(params: unknown) => void>>()
  const requestHandlers = new Map<
    string,
    (params: unknown) => unknown | Promise<unknown>
  >()
  return {
    ready: Promise.resolve({
      protocolVersion: 1,
      engineInfo: { name: "fake", version: "0" },
      engineCapabilities: { agents: [], nodeKinds: [] },
      workspace: { home: "/tmp", id: "ws" },
    }),
    call: async () => ({}) as never,
    onNotification(method, handler) {
      let set = notificationHandlers.get(method)
      if (!set) {
        set = new Set()
        notificationHandlers.set(method, set)
      }
      set.add(handler as (params: unknown) => void)
      return () => set?.delete(handler as (params: unknown) => void)
    },
    onRequest(method, handler) {
      requestHandlers.set(method, handler as (params: unknown) => unknown)
      return () => requestHandlers.delete(method)
    },
    on() {
      return () => {}
    },
    close() {},
    emitNotification(method, params) {
      for (const h of notificationHandlers.get(method) ?? []) h(params)
    },
    async emitRequest(method, params) {
      const handler = requestHandlers.get(method)
      if (!handler) throw new Error(`no handler for ${method}`)
      return handler(params)
    },
  }
}

describe("desktop-host", () => {
  afterEach(() => {
    delete window.flowsDesktop
  })

  it("declares revealPath and notifications capabilities", () => {
    expect(desktopClientCapabilities()).toEqual({
      host: { revealPath: true, notifications: true },
    })
  })

  it("handles host/reveal_path and inbox item_added", async () => {
    const revealPath = vi.fn()
    const notifyInboxItem = vi.fn()
    window.flowsDesktop = {
      connect: () => {},
      revealPath,
      notifyInboxItem,
    }
    const client = fakeDesktopClient()

    installDesktopHost(client)
    await client.ready
    await Promise.resolve()

    await client.emitRequest("host/reveal_path", { path: "/tmp/x" })
    expect(revealPath).toHaveBeenCalledWith("/tmp/x")

    client.emitNotification("inbox/update", {
      seq: 1,
      kind: "item_added",
      item: {
        id: "a1",
        kind: "approval",
        runId: "r1",
        nodeId: "n1",
        pass: 1,
        question: "Ship it?",
        at: "2026-11-24T00:00:00Z",
        status: "open",
      },
    })
    expect(notifyInboxItem).toHaveBeenCalledWith({
      title: "Approval needed",
      body: "Ship it?",
    })
  })
})

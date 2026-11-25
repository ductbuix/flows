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

  it("declares revealPath, notifications and browserSignIn", () => {
    expect(desktopClientCapabilities()).toEqual({
      host: { revealPath: true, notifications: true, browserSignIn: true },
    })
  })

  it("handles host/reveal_path, host/browser_sign_in and inbox item_added", async () => {
    const revealPath = vi.fn()
    const notifyInboxItem = vi.fn()
    const browserSignIn = vi.fn().mockResolvedValue({ cancelled: true })
    window.flowsDesktop = {
      connect: () => {},
      revealPath,
      notifyInboxItem,
      browserSignIn,
    }
    const client = fakeDesktopClient()

    installDesktopHost(client)
    await client.ready
    await Promise.resolve()

    await client.emitRequest("host/reveal_path", { path: "/tmp/x" })
    expect(revealPath).toHaveBeenCalledWith("/tmp/x")

    const signIn = await client.emitRequest("host/browser_sign_in", {
      connectorId: "rally",
      url: "https://rally.example/",
      cookieDomains: ["rally.example"],
    })
    expect(browserSignIn).toHaveBeenCalledWith({
      connectorId: "rally",
      url: "https://rally.example/",
      cookieDomains: ["rally.example"],
    })
    expect(signIn).toEqual({ cancelled: true })

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

  it("shows system notices only for channel system", async () => {
    const notifySystem = vi.fn()
    window.flowsDesktop = {
      connect: () => {},
      revealPath: vi.fn(),
      notifyInboxItem: vi.fn(),
      notifySystem,
      browserSignIn: vi.fn(),
    }
    const client = fakeDesktopClient()
    installDesktopHost(client)
    await client.ready
    await Promise.resolve()

    const notice = {
      title: "Shipped",
      text: "## build\n\nall green\n",
      runId: "r1",
      workflowId: "wf",
      nodeId: "done",
    }
    client.emitNotification("notice/update", {
      seq: 2,
      kind: "notice_added",
      notice: { ...notice, channel: "app" },
    })
    expect(notifySystem).not.toHaveBeenCalled()
    client.emitNotification("notice/update", {
      seq: 3,
      kind: "notice_added",
      notice: { ...notice, channel: "system" },
    })
    expect(notifySystem).toHaveBeenCalledWith({
      title: "Shipped",
      body: "all green",
    })
  })
})

import { describe, expect, it, vi } from "vitest"
import { createFcpConnection } from "../rpc/initialize.ts"
import { createPeerHostReveal } from "./host-reveal.ts"

describe("createPeerHostReveal", () => {
  it("requests host/reveal_path when the client declared the capability", async () => {
    const connection = createFcpConnection()
    connection.initialized = true
    connection.clientCapabilities = { host: { revealPath: true } }
    const peer = { request: vi.fn(async () => ({})) }
    const reveal = createPeerHostReveal(peer, connection, (p) => `/home/${p}`)
    await reveal("docket/board.yaml")
    expect(peer.request).toHaveBeenCalledWith("host/reveal_path", {
      path: "/home/docket/board.yaml",
    })
  })

  it("throws unsupported without host.revealPath", async () => {
    const connection = createFcpConnection()
    connection.clientCapabilities = {}
    const peer = { request: vi.fn() }
    const reveal = createPeerHostReveal(peer, connection, (p) => p)
    await expect(reveal("x")).rejects.toMatchObject({ code: "unsupported" })
    expect(peer.request).not.toHaveBeenCalled()
  })
})

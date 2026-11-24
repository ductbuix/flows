import { FCP_VERSION, initializeMethod, pingMethod } from "@workspace/contracts"
import { createEngine } from "@workspace/engine"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { WebSocket } from "ws"
import { createApp } from "./app.ts"
import {
  openFcpWs,
  startFcpServer,
  trackTempHome,
  waitWsClose,
} from "./fcp-harness.ts"
import { FCP_AUTH_CLOSE } from "./fcp-routes.ts"

describe("GET /", () => {
  it("exposes the FCP token for same-origin scripts", async () => {
    const home = trackTempHome(mkdtempSync(join(tmpdir(), "flowapp-fcp-idx-")))
    const token = "page-token"
    const engine = createEngine({ home })
    const app = createApp({ engine, fcpToken: token, port: 8787 })
    const res = await app.request("http://127.0.0.1:8787/", {
      headers: { Host: "127.0.0.1:8787" },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/text\/html/)
    const html = await res.text()
    expect(html).toContain("window.__FLOWS_FCP__=")
    expect(html).toContain(JSON.stringify(token))
    expect(html).toContain("ws://127.0.0.1:8787/fcp")
    engine.close()
  })

  it("rejects a rebinding Host with 403", async () => {
    const home = trackTempHome(
      mkdtempSync(join(tmpdir(), "flowapp-fcp-rebind-"))
    )
    const engine = createEngine({ home })
    const app = createApp({ engine, fcpToken: "secret", port: 8787 })
    const res = await app.request("http://127.0.0.1:8787/", {
      headers: { Host: "evil.example:8787" },
    })
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain("__FLOWS_FCP__")
    engine.close()
  })
})

describe("GET /api/fcp", () => {
  it("returns token bootstrap for loopback Host and Origin", async () => {
    const home = trackTempHome(mkdtempSync(join(tmpdir(), "flowapp-api-fcp-")))
    const token = "api-boot"
    const engine = createEngine({ home })
    const app = createApp({ engine, fcpToken: token, port: 8787 })
    const res = await app.request("http://127.0.0.1:8787/api/fcp", {
      headers: {
        Host: "127.0.0.1:8787",
        Origin: "http://127.0.0.1:5173",
      },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      token,
      url: "ws://127.0.0.1:8787/fcp",
    })
    engine.close()
  })

  it("rejects a rebinding Host with 403", async () => {
    const home = trackTempHome(
      mkdtempSync(join(tmpdir(), "flowapp-api-fcp-host-"))
    )
    const engine = createEngine({ home })
    const app = createApp({ engine, fcpToken: "secret", port: 8787 })
    const res = await app.request("http://127.0.0.1:8787/api/fcp", {
      headers: { Host: "evil.example:8787" },
    })
    expect(res.status).toBe(403)
    engine.close()
  })

  it("rejects an evil Origin with 403", async () => {
    const home = trackTempHome(
      mkdtempSync(join(tmpdir(), "flowapp-api-fcp-origin-"))
    )
    const engine = createEngine({ home })
    const app = createApp({ engine, fcpToken: "secret", port: 8787 })
    const res = await app.request("http://127.0.0.1:8787/api/fcp", {
      headers: {
        Host: "127.0.0.1:8787",
        Origin: "http://evil.example",
      },
    })
    expect(res.status).toBe(403)
    engine.close()
  })
})

describe("GET /fcp", () => {
  it("closes with 4401 when the token is wrong", async () => {
    const h = await startFcpServer()
    const socket = await openFcpWs(h.port, "wrong-token")
    expect(await waitWsClose(socket)).toBe(FCP_AUTH_CLOSE)
  })

  it("closes with 4401 when Host is a rebinding name", async () => {
    const h = await startFcpServer()
    const socket = await openFcpWs(h.port, h.token, {
      Host: `evil.example:${h.port}`,
    })
    expect(await waitWsClose(socket)).toBe(FCP_AUTH_CLOSE)
  })

  it("closes with 4401 when Origin is evil", async () => {
    const h = await startFcpServer()
    const socket = await openFcpWs(h.port, h.token, {
      Origin: "http://evil.example",
    })
    expect(await waitWsClose(socket)).toBe(FCP_AUTH_CLOSE)
  })

  it("accepts Origin http://127.0.0.1:5173", async () => {
    const h = await startFcpServer()
    const socket = await openFcpWs(h.port, h.token, {
      Origin: "http://127.0.0.1:5173",
    })
    expect(socket.readyState).toBe(WebSocket.OPEN)
    const peer = new RpcPeer(wsTransport(socket))
    await peer.request("initialize", {
      protocolVersion: FCP_VERSION,
      clientInfo: { name: "fcp-test", version: "0.0.0" },
      clientCapabilities: {},
    })
    const pong = pingMethod.result.parse(await peer.request("ping", {}))
    expect(pong).toEqual({ ok: true })
    socket.close()
  })

  it("connects, initializes and answers ping", async () => {
    const h = await startFcpServer()
    const socket = await openFcpWs(h.port, h.token, {
      Origin: `http://127.0.0.1:${h.port}`,
    })
    const peer = new RpcPeer(wsTransport(socket))

    const init = initializeMethod.result.parse(
      await peer.request("initialize", {
        protocolVersion: FCP_VERSION,
        clientInfo: { name: "fcp-test", version: "0.0.0" },
        clientCapabilities: {},
      })
    )
    expect(init.protocolVersion).toBe(FCP_VERSION)
    expect(init.workspace.home).toBe(h.home)
    expect(init.engineCapabilities).toEqual({
      agents: [],
      nodeKinds: [],
      blobs: { http: `http://127.0.0.1:${h.port}/blobs` },
    })

    const pong = pingMethod.result.parse(await peer.request("ping", {}))
    expect(pong).toEqual({ ok: true })

    socket.close()
  })
})

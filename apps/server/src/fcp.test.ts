import { serve } from "@hono/node-server"
import { FCP_VERSION, initializeMethod, pingMethod } from "@workspace/contracts"
import { createEngine } from "@workspace/engine"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { mkdtempSync, rmSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocket, WebSocketServer } from "ws"
import { createApp } from "./app.ts"
import { FCP_AUTH_CLOSE } from "./fcp-routes.ts"

type Harness = {
  home: string
  port: number
  token: string
  close: () => Promise<void>
}

const homes: string[] = []
const harnesses: Harness[] = []

afterEach(async () => {
  for (const h of harnesses.splice(0)) {
    await h.close()
  }
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

async function startFcpServer(): Promise<Harness> {
  const home = mkdtempSync(join(tmpdir(), "flowapp-fcp-"))
  homes.push(home)
  const token = "integration-fcp-token"
  const engine = createEngine({ home })
  const app = createApp({ engine, fcpToken: token })

  const server = serve({
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: 0,
    websocket: { server: new WebSocketServer({ noServer: true }) },
  })

  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve())
    server.once("error", reject)
  })

  const { port } = server.address() as AddressInfo
  const harness: Harness = {
    home,
    port,
    token,
    async close() {
      engine.close()
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
  harnesses.push(harness)
  return harness
}

function openWs(
  port: number,
  token: string,
  headers?: Record<string, string>
): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/fcp?token=${token}`, {
    headers,
  })
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket))
    socket.once("error", reject)
  })
}

function waitClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once("close", (code) => resolve(code))
  })
}

describe("GET /", () => {
  it("exposes the FCP token for same-origin scripts", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-fcp-idx-"))
    homes.push(home)
    const token = "page-token"
    const engine = createEngine({ home })
    const app = createApp({ engine, fcpToken: token })
    const res = await app.request("http://127.0.0.1:8787/")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/text\/html/)
    const html = await res.text()
    expect(html).toContain("window.__FLOWS_FCP__=")
    expect(html).toContain(JSON.stringify(token))
    expect(html).toContain("ws://127.0.0.1:8787/fcp")
    engine.close()
  })
})

describe("GET /fcp", () => {
  it("closes with 4401 when the token is wrong", async () => {
    const h = await startFcpServer()
    const socket = await openWs(h.port, "wrong-token")
    expect(await waitClose(socket)).toBe(FCP_AUTH_CLOSE)
  })

  it("closes with 4401 when Origin does not match Host", async () => {
    const h = await startFcpServer()
    const socket = await openWs(h.port, h.token, {
      Origin: "http://evil.example",
    })
    expect(await waitClose(socket)).toBe(FCP_AUTH_CLOSE)
  })

  it("connects, initializes and answers ping", async () => {
    const h = await startFcpServer()
    const socket = await openWs(h.port, h.token, {
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
    expect(init.engineCapabilities).toEqual({ agents: [], nodeKinds: [] })

    const pong = pingMethod.result.parse(await peer.request("ping", {}))
    expect(pong).toEqual({ ok: true })

    socket.close()
  })
})

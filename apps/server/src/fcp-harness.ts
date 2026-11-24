import { serve } from "@hono/node-server"
import { createEngine } from "@workspace/engine"
import { mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:net"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach } from "vitest"
import { WebSocket, WebSocketServer } from "ws"
import { createApp } from "./app.ts"

export type FcpHarness = {
  home: string
  port: number
  token: string
  engine: ReturnType<typeof createEngine>
  close: () => Promise<void>
}

const homes: string[] = []
const harnesses: FcpHarness[] = []

afterEach(async () => {
  for (const h of harnesses.splice(0)) {
    await h.close()
  }
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
}, 30_000)

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo
      const { port } = addr
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
    server.on("error", reject)
  })
}

export async function startFcpServer(): Promise<FcpHarness> {
  const home = mkdtempSync(join(tmpdir(), "flowapp-fcp-"))
  homes.push(home)
  const token = "integration-fcp-token"
  const port = await freePort()
  const engine = createEngine({ home })
  const app = createApp({ engine, fcpToken: token, port })

  const server = serve({
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port,
    websocket: { server: new WebSocketServer({ noServer: true }) },
  })

  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve())
    server.once("error", reject)
  })

  const harness: FcpHarness = {
    home,
    port,
    token,
    engine,
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

export function openFcpWs(
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

export function waitWsClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once("close", (code) => resolve(code))
  })
}

export function trackTempHome(home: string): string {
  homes.push(home)
  return home
}

import { createServer } from "node:http"
import { MessageChannel } from "node:worker_threads"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocketServer } from "ws"
import { RpcPeer, messagePortTransport, wsTransport } from "@workspace/protocol"
import { bridgePortToWebSocket } from "./fcp-bridge.ts"

const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length > 0) disposers.pop()!()
})

async function startEchoWs(): Promise<{
  url: string
  token: string
  close: () => void
}> {
  const token = "bridge-test-token"
  const server = createServer()
  const wss = new WebSocketServer({ server })
  wss.on("connection", (socket, req) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    if (url.searchParams.get("token") !== token) {
      socket.close(4401)
      return
    }
    const peer = new RpcPeer(wsTransport(socket))
    peer.onRequest("ping", async () => ({ ok: true }))
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const addr = server.address()
  if (!addr || typeof addr === "string") throw new Error("no address")
  const close = () => {
    wss.close()
    server.close()
  }
  disposers.push(close)
  return {
    url: `ws://127.0.0.1:${addr.port}/fcp`,
    token,
    close,
  }
}

describe("bridgePortToWebSocket", () => {
  it("forwards JSON-RPC requests to the daemon WebSocket", async () => {
    const daemon = await startEchoWs()
    const channel = new MessageChannel()
    const bridge = bridgePortToWebSocket(
      channel.port1,
      daemon.url,
      daemon.token
    )
    disposers.push(() => {
      bridge.dispose()
      channel.port1.close()
      channel.port2.close()
    })

    const client = new RpcPeer(messagePortTransport(channel.port2))
    const result = await client.request("ping", {})
    expect(result).toEqual({ ok: true })
  })
})

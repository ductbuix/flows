import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WebSocket, WebSocketServer } from "ws"
import { JSONRPC_VERSION, type JsonRpcMessage } from "./json-rpc.ts"
import { wsTransport } from "./ws-transport.ts"

type Harness = {
  port: number
  close: () => Promise<void>
  waitConnection: () => Promise<WebSocket>
}

async function listenWs(): Promise<Harness> {
  const server = createServer()
  const wss = new WebSocketServer({ server })
  const pending: Array<(socket: WebSocket) => void> = []
  const queued: WebSocket[] = []

  wss.on("connection", (socket) => {
    const next = pending.shift()
    if (next) next(socket)
    else queued.push(socket)
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const { port } = server.address() as AddressInfo

  return {
    port,
    waitConnection() {
      const queuedSocket = queued.shift()
      if (queuedSocket) return Promise.resolve(queuedSocket)
      return new Promise((resolve) => pending.push(resolve))
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        wss.close((err) => (err ? reject(err) : resolve()))
      })
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}

function openClient(port: number): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`)
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket))
    socket.once("error", reject)
  })
}

function waitMessage(
  transport: ReturnType<typeof wsTransport>
): Promise<JsonRpcMessage> {
  return new Promise((resolve) => {
    const off = transport.onMessage((msg) => {
      off()
      resolve(msg)
    })
  })
}

function waitClose(
  transport: ReturnType<typeof wsTransport>
): Promise<Error | undefined> {
  return new Promise((resolve) => {
    transport.onClose((err) => resolve(err))
  })
}

const ping: JsonRpcMessage = {
  jsonrpc: JSONRPC_VERSION,
  method: "ping",
  id: 1,
}

describe("wsTransport", () => {
  let harness: Harness | undefined
  const sockets: WebSocket[] = []

  afterEach(async () => {
    for (const socket of sockets.splice(0)) {
      socket.close()
    }
    if (harness) {
      await harness.close()
      harness = undefined
    }
  })

  it("sends and receives one JSON text frame per message", async () => {
    harness = await listenWs()
    const clientSocket = await openClient(harness.port)
    sockets.push(clientSocket)
    const serverSocket = await harness.waitConnection()
    sockets.push(serverSocket)

    const client = wsTransport(clientSocket)
    const server = wsTransport(serverSocket)
    const received = waitMessage(server)

    client.send(ping)
    await expect(received).resolves.toEqual(ping)
  })

  it("rejects binary frames with a logged error", async () => {
    harness = await listenWs()
    const clientSocket = await openClient(harness.port)
    sockets.push(clientSocket)
    const serverSocket = await harness.waitConnection()
    sockets.push(serverSocket)

    const server = wsTransport(serverSocket)
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const seen: JsonRpcMessage[] = []
    server.onMessage((msg) => seen.push(msg))

    serverSocket.once("message", () => {
      /* drain first so the transport handler runs */
    })
    clientSocket.send(Buffer.from([1, 2, 3]))

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalled()
    })
    expect(seen).toEqual([])
    expect(
      errorSpy.mock.calls.some(
        (args) =>
          typeof args[0] === "string" && args[0].includes("binary frame")
      )
    ).toBe(true)
    errorSpy.mockRestore()
  })

  it("forwards close to onClose", async () => {
    harness = await listenWs()
    const clientSocket = await openClient(harness.port)
    sockets.push(clientSocket)
    const serverSocket = await harness.waitConnection()
    sockets.push(serverSocket)

    const client = wsTransport(clientSocket)
    const closed = waitClose(client)
    client.close()
    await expect(closed).resolves.toBeUndefined()
  })

  it("forwards error then close to onClose with an Error", async () => {
    harness = await listenWs()
    const clientSocket = await openClient(harness.port)
    sockets.push(clientSocket)
    await harness.waitConnection()

    const client = wsTransport(clientSocket)
    const closed = waitClose(client)

    clientSocket.emit("error", new Error("boom"))
    clientSocket.terminate()

    const err = await closed
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toBe("boom")
  })
})

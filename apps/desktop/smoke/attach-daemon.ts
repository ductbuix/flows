import { acquireLock, releaseLock } from "@workspace/adapters-node"
import { wsTransport, type WsLike } from "@workspace/protocol"
import { createServer, type Server } from "node:http"
import { WebSocketServer } from "ws"
import { composeDesktopEngine } from "../src/compose-engine.ts"

export type AttachDaemon = {
  url: string
  token: string
  port: number
  close: () => void
}

/**
 * Minimal FCP WebSocket host that holds engine.lock so desktop can attach.
 */
export async function startAttachDaemon(home: string): Promise<AttachDaemon> {
  const token = `desktop-attach-${process.pid}`
  const engine = composeDesktopEngine(home)

  const server: Server = createServer((_req, res) => {
    res.statusCode = 404
    res.end()
  })
  const wss = new WebSocketServer({ server, path: "/fcp" })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const addr = server.address()
  if (!addr || typeof addr === "string") {
    throw new Error("attach-daemon: no listen address")
  }
  const port = addr.port
  const url = `ws://127.0.0.1:${port}/fcp`

  const lock = acquireLock(home, { url, token })
  if ("attachTo" in lock) {
    wss.close()
    server.close()
    engine.dispose()
    throw new Error(`attach-daemon: home already owned at ${lock.attachTo.url}`)
  }

  wss.on("connection", (socket, req) => {
    const reqUrl = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)
    if (reqUrl.searchParams.get("token") !== token) {
      socket.close(4401)
      return
    }
    engine.bindTransport(wsTransport(socket as unknown as WsLike))
  })

  return {
    url,
    token,
    port,
    close() {
      wss.close()
      server.close()
      engine.dispose()
      releaseLock(home)
    },
  }
}

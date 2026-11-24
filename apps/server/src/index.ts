import { randomBytes } from "node:crypto"
import { serve } from "@hono/node-server"
import { acquireLock, releaseLock } from "@workspace/adapters-node"
import {
  createEngine,
  fakeConnector,
  registerBuiltinConnectors,
  registerConnector,
} from "@workspace/engine"
import { WebSocketServer } from "ws"
import { createApp } from "./app.ts"

registerBuiltinConnectors()
// E2e and local demos only; not registered in normal app startup (BL-045).
if (process.env.FLOWAPP_FAKE_CONNECTOR === "1") {
  registerConnector(fakeConnector)
}

const engine = createEngine()
engine.startLibraryRetention()

const port = Number(process.env.PORT ?? 8787)
const fcpToken = randomBytes(32).toString("base64url")
const fcpUrl = `ws://127.0.0.1:${port}/fcp`
const lock = acquireLock(engine.home, { url: fcpUrl, token: fcpToken })
if ("attachTo" in lock) {
  if (!/^wss?:\/\//.test(lock.attachTo.url)) {
    console.error(
      `FLOWAPP_HOME engine busy (in-process), pid ${lock.attachTo.pid}`
    )
  } else {
    console.error(
      `FLOWAPP_HOME already owned at ${lock.attachTo.url}; attach instead of starting another daemon`
    )
  }
  process.exit(1)
}

const app = createApp({ engine, fcpToken, port })

const server = serve(
  {
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port,
    websocket: { server: new WebSocketServer({ noServer: true }) },
  },
  (info) => console.log(`server on http://127.0.0.1:${info.port}`)
)

function shutdown() {
  releaseLock(engine.home)
  engine.close()
  server.close(() => process.exit(0))
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, shutdown)
}

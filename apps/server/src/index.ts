import { serve } from "@hono/node-server"
import {
  createEngine,
  fakeConnector,
  registerConnector,
} from "@workspace/engine"
import { WebSocketServer } from "ws"
import { createApp } from "./app.ts"

// E2e and local demos only; not registered in normal app startup (BL-045).
if (process.env.FLOWAPP_FAKE_CONNECTOR === "1") {
  registerConnector(fakeConnector)
}

const engine = createEngine()
engine.resumeAll()
const app = createApp({ engine })

const port = Number(process.env.PORT ?? 8787)

const server = serve(
  {
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port,
    websocket: { server: new WebSocketServer({ noServer: true }) },
  },
  (info) => console.log(`server on http://127.0.0.1:${info.port}`)
)

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    engine.close()
    server.close(() => process.exit(0))
  })
}

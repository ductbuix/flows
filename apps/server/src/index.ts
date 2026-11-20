import { serve } from "@hono/node-server"
import { WebSocketServer } from "ws"
import { app } from "./app.ts"

const port = Number(process.env.PORT ?? 8787)

// Local only: bind to loopback, never 0.0.0.0.
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
  process.on(signal, () => server.close(() => process.exit(0)))
}

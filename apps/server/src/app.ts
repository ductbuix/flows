import { upgradeWebSocket } from "@hono/node-server"
import { Hono } from "hono"
import type { Health } from "@workspace/shared"

export const app = new Hono()
  .basePath("/api")
  .get("/health", (c) =>
    c.json({ ok: true, version: "0.0.1" } satisfies Health, 200)
  )
  .get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        ws.send(JSON.stringify({ type: "hello" }))
      },
    }))
  )

export type AppType = typeof app

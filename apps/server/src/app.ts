import type { Engine } from "@workspace/engine"
import { type Health } from "@workspace/contracts"
import { Hono } from "hono"
import { blobRoutes } from "./blob-routes.ts"
import { createFcpHost } from "./fcp-host.ts"
import {
  fcpBootstrapResponse,
  fcpIndexResponse,
  fcpUpgrade,
} from "./fcp-routes.ts"

export type CreateAppOptions = {
  engine: Engine
  /** Per-launch lock token; defaults for API-only tests. */
  fcpToken?: string
  /** Daemon listen port; used for FCP Host/Origin allowlists. */
  port?: number
}

export function createApp({
  engine,
  fcpToken = "test-fcp-token",
  port = Number(process.env.PORT ?? 8787),
}: CreateAppOptions) {
  const host = createFcpHost(engine)

  return new Hono()
    .get("/health", (c) =>
      c.json({ ok: true, version: "0.0.1" } satisfies Health, 200)
    )
    .get("/", (c) => fcpIndexResponse(c, fcpToken, port))
    .get("/fcp/bootstrap", (c) => fcpBootstrapResponse(c, fcpToken, port))
    .get("/fcp", fcpUpgrade(engine, fcpToken, port, host))
    .route("/blobs", blobRoutes(fcpToken))
}

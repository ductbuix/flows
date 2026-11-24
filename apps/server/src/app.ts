import { createEventBus, UpdateBus } from "@workspace/core"
import type { Engine } from "@workspace/engine"
import { type Health } from "@workspace/shared"
import { Hono } from "hono"
import { IdempotencyStore } from "./idempotency.ts"
import { bindEngineToBus } from "./engine-bus.ts"
import { createConnectorsFcp } from "./fcp-connectors.ts"
import { createDocketFcp } from "./fcp-docket.ts"
import { createInboxFcp } from "./fcp-inbox.ts"
import { createLibraryFcp } from "./fcp-library.ts"
import { createSkillsFcp } from "./fcp-skills.ts"
import { createFileFcp } from "./fcp-files.ts"
import { blobRoutes } from "./blob-routes.ts"
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
  const bus = new UpdateBus()
  const events = createEventBus()
  bindEngineToBus(engine, bus, events)
  const docket = createDocketFcp(engine, bus, events)
  const inbox = createInboxFcp(engine, bus)
  const library = createLibraryFcp(engine)
  const skills = createSkillsFcp(engine, bus)
  const connectors = createConnectorsFcp(engine)
  const files = createFileFcp(engine)
  const idempotency = new IdempotencyStore()

  return new Hono()
    .get("/health", (c) =>
      c.json({ ok: true, version: "0.0.1" } satisfies Health, 200)
    )
    .get("/", (c) => fcpIndexResponse(c, fcpToken, port))
    .get("/fcp/bootstrap", (c) => fcpBootstrapResponse(c, fcpToken, port))
    .get(
      "/fcp",
      fcpUpgrade(engine, fcpToken, port, bus, idempotency, {
        ...docket.bindings,
        ...inbox.bindings,
        ...library.bindings,
        ...skills.bindings,
        ...connectors,
        ...files,
      })
    )
    .route("/blobs", blobRoutes(fcpToken))
}

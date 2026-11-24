import { upgradeWebSocket } from "@hono/node-server"
import {
  bindEngine,
  bindInitialize,
  createFcpConnection,
  createSubscribeBindings,
  defineBinding,
  type UpdateBus,
} from "@workspace/core"
import { pingMethod } from "@workspace/contracts"
import type { Engine } from "@workspace/engine"
import { RpcPeer, wsTransport, type WsLike } from "@workspace/protocol"
import { randomUUID, timingSafeEqual } from "node:crypto"
import type { Context } from "hono"
import type { WSEvents } from "hono/ws"
import { fcpIndexHtml } from "./fcp-index.ts"
import { createWorkflowReadBindings } from "./fcp-workflow-read.ts"
import { createWorkflowWriteBindings } from "./fcp-workflow-write.ts"
import { createRunCommandBindings } from "./fcp-run-commands.ts"
import { createRunReadBindings } from "./fcp-run-read.ts"
import type { IdempotencyStore } from "./idempotency.ts"

export const FCP_AUTH_CLOSE = 4401
export const FCP_DEV_ORIGIN_PORT = 5173

const engineInfo = { name: "flows", version: "0.0.1" }

export function fcpAllowedHosts(port: number): Set<string> {
  return new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`])
}

export function fcpAllowedOrigins(port: number): Set<string> {
  return new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://127.0.0.1:${FCP_DEV_ORIGIN_PORT}`,
    `http://localhost:${FCP_DEV_ORIGIN_PORT}`,
  ])
}

/** True when Host is a loopback name on the daemon port. */
export function fcpHostAllowed(c: Context, port: number): boolean {
  const host = c.req.header("host")
  if (host == null || host === "") return false
  return fcpAllowedHosts(port).has(host.toLowerCase())
}

/** True when Origin is absent (CLI) or on the loopback Origin allowlist. */
export function fcpOriginAllowed(c: Context, port: number): boolean {
  const origin = c.req.header("origin")
  if (origin == null || origin === "") return true
  return fcpAllowedOrigins(port).has(origin)
}

export function fcpTokenMatches(c: Context, expected: string): boolean {
  const provided = c.req.query("token")
  if (provided == null) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function fcpAuthorized(
  c: Context,
  expectedToken: string,
  port: number
): boolean {
  return (
    fcpHostAllowed(c, port) &&
    fcpOriginAllowed(c, port) &&
    fcpTokenMatches(c, expectedToken)
  )
}

function fcpWsUrl(c: Context, port: number): string {
  const host = c.req.header("host") ?? `127.0.0.1:${port}`
  return `ws://${host}/fcp`
}

function bindFcpPeer(
  raw: WsLike,
  engine: Engine,
  bus: UpdateBus,
  idempotency: IdempotencyStore,
  port: number
): void {
  const transport = wsTransport(raw)
  const peer = new RpcPeer(transport)
  const connection = createFcpConnection()
  const ac = new AbortController()
  const peerId = randomUUID()
  const { bindings: subBindings, dispose: subDispose } =
    createSubscribeBindings(bus, peer, peerId)
  transport.onClose(() => {
    ac.abort()
    subDispose.dispose()
  })

  bindInitialize(peer, connection, {
    engineInfo,
    workspace: { home: engine.home, id: engine.home },
    engineCapabilities: {
      blobs: { http: `http://127.0.0.1:${port}/blobs` },
    },
  })
  bindEngine(
    peer,
    {
      ping: defineBinding(pingMethod, () => ({ ok: true as const })),
      ...createWorkflowReadBindings(engine),
      ...createWorkflowWriteBindings({ engine, bus }),
      ...subBindings,
      ...createRunReadBindings(engine),
      ...createRunCommandBindings({ engine, idempotency }),
    },
    { signal: ac.signal },
    { connection }
  )
}

function fcpEvents(
  c: Context,
  engine: Engine,
  token: string,
  port: number,
  bus: UpdateBus,
  idempotency: IdempotencyStore
): WSEvents {
  if (!fcpAuthorized(c, token, port)) {
    return {
      onOpen(_evt, ws) {
        ws.close(FCP_AUTH_CLOSE, "unauthorized")
      },
    }
  }

  return {
    onOpen(_evt, ws) {
      const raw = ws.raw
      if (!raw || typeof (raw as WsLike).addEventListener !== "function") {
        ws.close(1011, "no websocket")
        return
      }
      bindFcpPeer(raw as WsLike, engine, bus, idempotency, port)
    },
  }
}

export function fcpIndexResponse(
  c: Context,
  token: string,
  port: number
): Response {
  if (!fcpHostAllowed(c, port)) {
    return c.text("Forbidden", 403)
  }
  return c.html(fcpIndexHtml({ token, url: fcpWsUrl(c, port) }))
}

export function fcpUpgrade(
  engine: Engine,
  token: string,
  port: number,
  bus: UpdateBus,
  idempotency: IdempotencyStore
) {
  return upgradeWebSocket((c) =>
    fcpEvents(c, engine, token, port, bus, idempotency)
  )
}

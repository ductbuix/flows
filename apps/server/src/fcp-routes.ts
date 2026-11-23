import { upgradeWebSocket } from "@hono/node-server"
import {
  bindEngine,
  bindInitialize,
  createFcpConnection,
  defineBinding,
} from "@workspace/core"
import { pingMethod } from "@workspace/contracts"
import type { Engine } from "@workspace/engine"
import { RpcPeer, wsTransport, type WsLike } from "@workspace/protocol"
import type { Context } from "hono"
import type { WSEvents } from "hono/ws"
import { fcpIndexHtml } from "./fcp-index.ts"

export const FCP_AUTH_CLOSE = 4401

const engineInfo = { name: "flows", version: "0.0.1" }

/** True when Origin is absent (CLI) or matches this request's Host. */
export function fcpOriginAllowed(c: Context): boolean {
  const origin = c.req.header("origin")
  if (origin == null || origin === "") return true
  const host = c.req.header("host")
  if (!host) return false
  return origin === `http://${host}`
}

export function fcpTokenMatches(c: Context, expected: string): boolean {
  return c.req.query("token") === expected
}

export function fcpAuthorized(c: Context, expectedToken: string): boolean {
  return fcpOriginAllowed(c) && fcpTokenMatches(c, expectedToken)
}

function fcpWsUrl(c: Context): string {
  const host = c.req.header("host") ?? "127.0.0.1:8787"
  return `ws://${host}/fcp`
}

function bindFcpPeer(raw: WsLike, engine: Engine): void {
  const transport = wsTransport(raw)
  const peer = new RpcPeer(transport)
  const connection = createFcpConnection()
  const ac = new AbortController()
  transport.onClose(() => ac.abort())

  bindInitialize(peer, connection, {
    engineInfo,
    workspace: { home: engine.home, id: engine.home },
  })
  bindEngine(
    peer,
    {
      ping: defineBinding(pingMethod, () => ({ ok: true as const })),
    },
    { signal: ac.signal },
    { connection }
  )
}

function fcpEvents(c: Context, engine: Engine, token: string): WSEvents {
  if (!fcpAuthorized(c, token)) {
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
      bindFcpPeer(raw as WsLike, engine)
    },
  }
}

export function fcpIndexResponse(c: Context, token: string): Response {
  return c.html(fcpIndexHtml({ token, url: fcpWsUrl(c) }))
}

export function fcpUpgrade(engine: Engine, token: string) {
  return upgradeWebSocket((c) => fcpEvents(c, engine, token))
}

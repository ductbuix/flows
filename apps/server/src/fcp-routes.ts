import { upgradeWebSocket } from "@hono/node-server"
import type { Host } from "@workspace/adapters-node"
import { wsTransport, type WsLike } from "@workspace/protocol"
import { timingSafeEqual } from "node:crypto"
import type { Context } from "hono"
import type { WSEvents } from "hono/ws"
import { bindFcpTransport, type FcpHost } from "./fcp-host.ts"
import { fcpIndexHtml } from "./fcp-index.ts"

export const FCP_AUTH_CLOSE = 4401
export const FCP_DEV_ORIGIN_PORT = 5173

/** Vite ports allowed as FCP Host/Origin (default 5173; e2e sets PW_WEB_PORT). */
export function fcpDevOriginPorts(): number[] {
  const ports = new Set<number>([FCP_DEV_ORIGIN_PORT])
  const raw = process.env.PW_WEB_PORT
  if (raw) {
    const n = Number(raw)
    if (Number.isInteger(n) && n > 0) ports.add(n)
  }
  return [...ports]
}

export function fcpAllowedHosts(port: number): Set<string> {
  const hosts = new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`,
  ])
  // Vite proxies /fcp; without changeOrigin Host stays on the Vite port.
  for (const dev of fcpDevOriginPorts()) {
    hosts.add(`127.0.0.1:${dev}`)
    hosts.add(`localhost:${dev}`)
    hosts.add(`[::1]:${dev}`)
  }
  return hosts
}

export function fcpAllowedOrigins(port: number): Set<string> {
  const origins = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ])
  for (const dev of fcpDevOriginPorts()) {
    origins.add(`http://127.0.0.1:${dev}`)
    origins.add(`http://localhost:${dev}`)
  }
  return origins
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

function fcpEvents(
  c: Context,
  engine: Host,
  token: string,
  port: number,
  host: FcpHost
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
      bindFcpTransport(wsTransport(raw as WsLike), engine, host, {
        blobsHttp: `http://127.0.0.1:${port}/blobs`,
      })
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
  engine: Host,
  token: string,
  port: number,
  host: FcpHost
) {
  return upgradeWebSocket((c) => fcpEvents(c, engine, token, port, host))
}

/** JSON bootstrap for Vite (proxied as `/fcp/bootstrap`); same as `__FLOWS_FCP__`. */
export function fcpBootstrapJson(token: string, port: number) {
  return { token, url: `ws://127.0.0.1:${port}/fcp` }
}

/** Same Host + Origin guard as `/` and `/fcp` (loopback only). */
export function fcpBootstrapResponse(
  c: Context,
  token: string,
  port: number
): Response {
  if (!fcpHostAllowed(c, port) || !fcpOriginAllowed(c, port)) {
    return c.text("Forbidden", 403)
  }
  return c.json(fcpBootstrapJson(token, port), 200)
}

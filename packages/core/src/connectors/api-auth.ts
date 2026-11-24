import type { ConnectorAuth, ConnectorFile } from "@workspace/contracts"
import type { SecretStore } from "../ports/secret-store.ts"

/** Cookie shape under secrets/<id>/cookies.json (DES-026 / BL-162). */
export type StoredCookie = {
  name: string
  value: string
  /** Absent or empty → host-only for the connector `how` host (RFC 6265). */
  domain?: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "Strict" | "Lax" | "None"
}

export function cookiesSecretKey(connectorId: string): string {
  return `${connectorId}/cookies.json`
}

export function tokenSecretKey(connectorId: string): string {
  return `${connectorId}/token`
}

export function parseCookies(raw: unknown): StoredCookie[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: StoredCookie[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return undefined
    const c = entry as Record<string, unknown>
    if (typeof c.name !== "string" || c.name.length === 0) return undefined
    if (typeof c.value !== "string") return undefined
    const path = typeof c.path === "string" && c.path.length > 0 ? c.path : "/"
    const cookie: StoredCookie = {
      name: c.name,
      value: c.value,
      path,
    }
    if (typeof c.domain === "string" && c.domain.length > 0) {
      cookie.domain = c.domain
    }
    if (typeof c.expires === "number") cookie.expires = c.expires
    if (typeof c.httpOnly === "boolean") cookie.httpOnly = c.httpOnly
    if (typeof c.secure === "boolean") cookie.secure = c.secure
    if (
      c.sameSite === "Strict" ||
      c.sameSite === "Lax" ||
      c.sameSite === "None"
    ) {
      cookie.sameSite = c.sameSite
    }
    out.push(cookie)
  }
  return out
}

function liveCookies(cookies: StoredCookie[], nowMs: number): StoredCookie[] {
  const nowSec = nowMs / 1000
  return cookies.filter((c) => c.expires === undefined || c.expires > nowSec)
}

/** RFC 6265 domain-match: exact or request-host is a subdomain of cookie-domain. */
function domainMatches(cookieDomain: string, host: string): boolean {
  const d = cookieDomain.replace(/^\./, "").toLowerCase()
  const h = host.replace(/^\./, "").toLowerCase()
  return d === h || h.endsWith(`.${d}`)
}

/** RFC 6265 path-match: cookie-path is a prefix of request-path. */
function pathMatches(cookiePath: string, requestPath: string): boolean {
  if (requestPath === cookiePath) return true
  if (!requestPath.startsWith(cookiePath)) return false
  if (cookiePath.endsWith("/")) return true
  return requestPath.charAt(cookiePath.length) === "/"
}

function cookieMatchesRequest(
  cookie: StoredCookie,
  requestUrl: URL,
  howHost: string
): boolean {
  if (cookie.secure && requestUrl.protocol !== "https:") return false
  const host = requestUrl.hostname
  const domain = cookie.domain
  if (domain === undefined || domain.length === 0) {
    if (host !== howHost.toLowerCase()) return false
  } else if (!domainMatches(domain, host)) {
    return false
  }
  return pathMatches(cookie.path || "/", requestUrl.pathname)
}

function cookieHeader(cookies: StoredCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ")
}

/**
 * Build Cookie or Authorization headers from SecretStore for the connector's
 * auth kind. Returns null when the secret is missing or empty. Cookies are
 * filtered to the request URL (domain / path / secure).
 */
export function authHeaders(
  secrets: SecretStore,
  connector: ConnectorFile,
  nowMs: number,
  requestUrl: string
): Headers | null {
  const headers = new Headers()
  if (connector.auth === "cookies") {
    const raw = secrets.get(cookiesSecretKey(connector.id))
    if (raw === null) return null
    let parsed: StoredCookie[] | undefined
    try {
      parsed = parseCookies(JSON.parse(raw) as unknown)
    } catch {
      return null
    }
    if (!parsed) return null
    const url = new URL(requestUrl)
    const howHost = new URL(connector.how).hostname
    const live = liveCookies(parsed, nowMs).filter((c) =>
      cookieMatchesRequest(c, url, howHost)
    )
    if (live.length === 0) return null
    headers.set("Cookie", cookieHeader(live))
    return headers
  }
  if (connector.auth === "pat" || connector.auth === "oauth") {
    const token = secrets.get(tokenSecretKey(connector.id))
    if (token === null || token.trim().length === 0) return null
    headers.set("Authorization", `Bearer ${token.trim()}`)
    return headers
  }
  return null
}

export function isApiAuth(auth: ConnectorAuth): boolean {
  return auth === "cookies" || auth === "pat" || auth === "oauth"
}

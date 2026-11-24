import {
  hostBrowserSignInResultSchema,
  type HostStoredCookie,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { FcpConnection } from "../rpc/initialize.ts"

export type BrowserSignInRequest = {
  connectorId: string
  url: string
  cookieDomains: string[]
}

export type BrowserSignInOutcome =
  { cookies: HostStoredCookie[] } | { cancelled: true }

export type ChromeBrowserSignIn = (
  req: BrowserSignInRequest,
  signal?: AbortSignal
) => Promise<BrowserSignInOutcome>

type HostPeer = {
  request(method: string, params?: unknown): Promise<unknown>
}

function hasBrowserSignInCapability(connection: FcpConnection): boolean {
  const caps = connection.clientCapabilities as
    { host?: { browserSignIn?: boolean } } | undefined
  return caps?.host?.browserSignIn === true
}

/** RFC-ish domain match used when filtering host cookies (BL-190). */
export function cookieDomainMatches(
  cookieDomain: string,
  allowed: string
): boolean {
  const d = cookieDomain.replace(/^\./, "").toLowerCase()
  const a = allowed.replace(/^\./, "").toLowerCase()
  return d === a || d.endsWith(`.${a}`) || a.endsWith(`.${d}`)
}

export function filterCookiesForDomains(
  cookies: HostStoredCookie[],
  cookieDomains: string[]
): HostStoredCookie[] {
  return cookies.filter((c) => {
    const domain = c.domain
    if (!domain || domain.length === 0) return false
    return cookieDomains.some((allowed) => cookieDomainMatches(domain, allowed))
  })
}

/**
 * Prefer `host/browser_sign_in` when the client declared the capability;
 * otherwise use today's Chrome adapter (DES-040 / BL-190).
 */
export async function performBrowserSignIn(
  deps: {
    peer?: HostPeer
    connection?: FcpConnection
    chromeSignIn?: ChromeBrowserSignIn
  },
  req: BrowserSignInRequest,
  signal?: AbortSignal
): Promise<BrowserSignInOutcome> {
  if (deps.connection && hasBrowserSignInCapability(deps.connection)) {
    if (!deps.peer) {
      throw engineError("internal", "Host peer missing for browser sign-in")
    }
    const raw = await deps.peer.request("host/browser_sign_in", req)
    return hostBrowserSignInResultSchema.parse(raw)
  }
  if (deps.chromeSignIn) {
    return deps.chromeSignIn(req, signal)
  }
  throw engineError(
    "unsupported",
    "Browser sign-in is not available on this host"
  )
}

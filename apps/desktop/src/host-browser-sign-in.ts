import {
  BrowserWindow,
  session as electronSession,
  type Cookie,
  type Session,
} from "electron"
import type { HostStoredCookie } from "@workspace/contracts"

export type BrowserSignInParams = {
  connectorId: string
  url: string
  cookieDomains: string[]
}

export type BrowserSignInResult =
  { cookies: HostStoredCookie[] } | { cancelled: true }

/** Persistent partition name per connector (BL-190). */
export function signInPartition(connectorId: string): string {
  return `persist:flows-signin-${connectorId}`
}

export function cookieDomainMatches(
  cookieDomain: string,
  allowed: string
): boolean {
  const d = cookieDomain.replace(/^\./, "").toLowerCase()
  const a = allowed.replace(/^\./, "").toLowerCase()
  return d === a || d.endsWith(`.${a}`) || a.endsWith(`.${d}`)
}

function electronSameSite(
  value: Cookie["sameSite"]
): HostStoredCookie["sameSite"] {
  if (value === "strict") return "Strict"
  if (value === "lax") return "Lax"
  if (value === "no_restriction") return "None"
  return undefined
}

export function filterSessionCookies(
  cookies: Cookie[],
  cookieDomains: string[]
): HostStoredCookie[] {
  const matched: HostStoredCookie[] = []
  for (const c of cookies) {
    const domain = c.domain
    if (!domain) continue
    if (
      !cookieDomains.some((allowed) => cookieDomainMatches(domain, allowed))
    ) {
      continue
    }
    matched.push({
      name: c.name,
      value: c.value,
      domain,
      path: c.path || "/",
      expires:
        typeof c.expirationDate === "number" ? c.expirationDate : undefined,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: electronSameSite(c.sameSite),
    })
  }
  return matched
}

export type BrowserSignInHost = {
  fromPartition(partition: string): Session
  openWindow(opts: {
    partition: string
    url: string
  }): Promise<{ closed: Promise<void>; close: () => void }>
}

function createDefaultHost(): BrowserSignInHost {
  return {
    fromPartition(partition) {
      return electronSession.fromPartition(partition)
    },
    openWindow({ partition, url }) {
      const win = new BrowserWindow({
        width: 960,
        height: 720,
        show: true,
        title: "Sign in",
        webPreferences: {
          partition,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      })
      void win.loadURL(url)
      return Promise.resolve({
        closed: new Promise<void>((resolve) => {
          win.once("closed", () => resolve())
        }),
        close: () => {
          if (!win.isDestroyed()) win.close()
        },
      })
    },
  }
}

let activeHost: BrowserSignInHost | undefined

export function setBrowserSignInHost(next: BrowserSignInHost): void {
  activeHost = next
}

export function getBrowserSignInHost(): BrowserSignInHost {
  if (!activeHost) activeHost = createDefaultHost()
  return activeHost
}

/**
 * Open a partitioned Electron window for cookie sign-in.
 * Closing the window returns domain-filtered cookies; abort → cancelled.
 */
export async function openBrowserSignIn(
  params: BrowserSignInParams,
  signal?: AbortSignal
): Promise<BrowserSignInResult> {
  if (signal?.aborted) return { cancelled: true }

  const host = getBrowserSignInHost()
  const partition = signInPartition(params.connectorId)
  const sess = host.fromPartition(partition)
  const win = await host.openWindow({ partition, url: params.url })

  let cancelled = false
  const onAbort = () => {
    cancelled = true
    win.close()
  }
  signal?.addEventListener("abort", onAbort, { once: true })
  if (signal?.aborted) onAbort()

  try {
    await win.closed
  } finally {
    signal?.removeEventListener("abort", onAbort)
  }

  if (cancelled || signal?.aborted) return { cancelled: true }

  const all = await sess.cookies.get({})
  return {
    cookies: filterSessionCookies(all, params.cookieDomains),
  }
}

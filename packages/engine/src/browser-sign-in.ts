import { chromium, type Cookie } from "playwright-core"
import type { Connection } from "./connection-model.ts"
import {
  ensureSecretsDir,
  profileDir,
  writeCookies,
  type StoredCookie,
} from "./secrets.ts"

export class BrowserSignInError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BrowserSignInError"
  }
}

/** Hostname used to open Chrome and filter saved cookies. */
export function connectionSignInHost(connection: Connection): string {
  const raw = connection.scope.domain ?? connection.scope.url
  if (!raw || raw.trim().length === 0) {
    throw new BrowserSignInError(
      "connection scope needs domain or url for browser sign-in"
    )
  }
  try {
    const href = raw.includes("://") ? raw : `https://${raw}`
    return new URL(href).hostname
  } catch {
    throw new BrowserSignInError(`invalid sign-in domain: ${raw}`)
  }
}

function startUrl(connection: Connection): string {
  const raw = connection.scope.url ?? connection.scope.domain
  if (!raw) {
    throw new BrowserSignInError(
      "connection scope needs domain or url for browser sign-in"
    )
  }
  return raw.includes("://") ? raw : `https://${raw}`
}

function cookieMatchesHost(cookieDomain: string, host: string): boolean {
  const d = cookieDomain.replace(/^\./, "").toLowerCase()
  const h = host.replace(/^\./, "").toLowerCase()
  return d === h || h.endsWith(`.${d}`) || d.endsWith(`.${h}`)
}

function toStored(cookie: Cookie): StoredCookie {
  const sameSite =
    cookie.sameSite === "Strict" ||
    cookie.sameSite === "Lax" ||
    cookie.sameSite === "None"
      ? cookie.sameSite
      : undefined
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || "/",
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite,
  }
}

export type BrowserSignInResult = {
  cookies: StoredCookie[]
}

/**
 * Launch installed Chrome with a dedicated profile under secrets/<id>/profile/,
 * wait until the user closes the window, then save domain cookies (DES-026).
 */
export async function signInWithBrowser(
  home: string,
  connection: Connection
): Promise<BrowserSignInResult> {
  if (connection.signIn !== "cookies") {
    throw new BrowserSignInError(
      `sign-in method is ${connection.signIn}, not cookies`
    )
  }
  const host = connectionSignInHost(connection)
  const url = startUrl(connection)
  ensureSecretsDir(home, connection.id)
  const userDataDir = profileDir(home, connection.id)

  let context
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: false,
      viewport: null,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new BrowserSignInError(
      `Chrome is not installed or could not be launched (${detail})`
    )
  }

  let lastCookies: Cookie[] = []
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {
      // User may still sign in from the new-tab page if navigation fails.
    })

    const browser = context.browser()
    while (browser?.isConnected()) {
      try {
        lastCookies = await context.cookies()
      } catch {
        break
      }
      await new Promise((r) => setTimeout(r, 400))
    }
  } finally {
    await context.close().catch(() => {})
  }

  const filtered = lastCookies
    .filter((c) => cookieMatchesHost(c.domain, host))
    .map(toStored)
  writeCookies(home, connection.id, filtered)
  return { cookies: filtered }
}

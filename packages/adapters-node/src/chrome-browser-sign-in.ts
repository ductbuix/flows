import type {
  BrowserSignInOutcome,
  BrowserSignInRequest,
  ChromeBrowserSignIn,
} from "@workspace/core"
import { chromium, type Cookie } from "playwright-core"
import { chmodSync, mkdirSync } from "node:fs"
import { join } from "node:path"

function profileDir(home: string, connectorId: string): string {
  return join(home, "secrets", connectorId, "profile")
}

function ensureProfileDir(home: string, connectorId: string): string {
  const dir = profileDir(home, connectorId)
  mkdirSync(dir, { recursive: true })
  chmodSync(join(home, "secrets"), 0o700)
  chmodSync(join(home, "secrets", connectorId), 0o700)
  chmodSync(dir, 0o700)
  return dir
}

function domainMatches(cookieDomain: string, allowed: string): boolean {
  const d = cookieDomain.replace(/^\./, "").toLowerCase()
  const a = allowed.replace(/^\./, "").toLowerCase()
  return d === a || d.endsWith(`.${a}`) || a.endsWith(`.${d}`)
}

function toStored(cookie: Cookie) {
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

/**
 * Launch installed Chrome with a dedicated profile (today's sign-in path
 * when the client lacks `host.browserSignIn`, BL-190).
 */
export function createChromeBrowserSignIn(options: {
  home: string
}): ChromeBrowserSignIn {
  return async (
    req: BrowserSignInRequest,
    signal?: AbortSignal
  ): Promise<BrowserSignInOutcome> => {
    if (signal?.aborted) return { cancelled: true }

    const userDataDir = ensureProfileDir(options.home, req.connectorId)
    let context
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: "chrome",
        headless: false,
        viewport: null,
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Chrome is not installed or could not be launched (${detail})`,
        { cause: err }
      )
    }

    let lastCookies: Cookie[] = []
    const onAbort = () => {
      void context.close().catch(() => {})
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    try {
      if (signal?.aborted) return { cancelled: true }
      const page = context.pages()[0] ?? (await context.newPage())
      await page
        .goto(req.url, { waitUntil: "domcontentloaded" })
        .catch(() => {})

      const browser = context.browser()
      while (browser?.isConnected()) {
        if (signal?.aborted) return { cancelled: true }
        try {
          lastCookies = await context.cookies()
        } catch {
          break
        }
        await new Promise((r) => setTimeout(r, 400))
      }
    } finally {
      signal?.removeEventListener("abort", onAbort)
      await context.close().catch(() => {})
    }

    if (signal?.aborted) return { cancelled: true }

    const cookies = lastCookies
      .filter((c) => req.cookieDomains.some((d) => domainMatches(c.domain, d)))
      .map(toStored)
    return { cookies }
  }
}

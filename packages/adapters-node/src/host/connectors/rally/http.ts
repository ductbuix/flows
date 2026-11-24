import type { StoredCookie } from "../../secrets.ts"
import { cookieHeader, type RallyFetch, type RallyJson } from "./types.ts"

export class RallyHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "RallyHttpError"
  }
}

export function errorsOf(body: RallyJson): string[] {
  for (const key of Object.keys(body)) {
    const wrap = body[key]
    if (!wrap || typeof wrap !== "object") continue
    const errs = (wrap as RallyJson).Errors
    if (Array.isArray(errs)) {
      return errs.filter((e): e is string => typeof e === "string")
    }
  }
  return []
}

export function createRallyRequest(
  baseUrl: string,
  cookies: StoredCookie[],
  fetchFn: RallyFetch = fetch
) {
  const cookie = cookieHeader(cookies)
  const base = baseUrl.replace(/\/$/, "")

  return async function request(
    path: string,
    init: RequestInit = {}
  ): Promise<{ status: number; body: RallyJson }> {
    const headers = new Headers(init.headers)
    headers.set("Cookie", cookie)
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
    const res = await fetchFn(`${base}${path}`, { ...init, headers })
    const text = await res.text()
    let body: RallyJson = {}
    if (text.trim().length > 0) {
      try {
        body = JSON.parse(text) as RallyJson
      } catch {
        throw new RallyHttpError(
          `rally returned non-JSON (${res.status})`,
          res.status
        )
      }
    }
    return { status: res.status, body }
  }
}

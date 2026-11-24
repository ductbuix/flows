import { createNodeSecretStore } from "@workspace/adapters-node"
import type { SecretStore } from "@workspace/core/ports"
import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { secretsDir, secretsRoot } from "./paths.ts"

const DIR_MODE = 0o700

/** Cookie shape stored under secrets/<id>/cookies.json (DES-026 / BL-053). */
export type StoredCookie = {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "Strict" | "Lax" | "None"
}

/** Absolute on-disk path; unchanged for callers that inspect the file. */
export function cookiesPath(home: string, connectionId: string): string {
  return join(secretsDir(home, connectionId), "cookies.json")
}

/** Logical SecretStore key relative to FLOWAPP_HOME/secrets. */
function cookiesKey(connectionId: string): string {
  return `${connectionId}/cookies.json`
}

function secretStoreFor(home: string): SecretStore {
  return createNodeSecretStore({ root: secretsRoot(home) })
}

export function profileDir(home: string, connectionId: string): string {
  return join(secretsDir(home, connectionId), "profile")
}

/** Ensure `secrets/` and a connection folder exist as mode 0700. */
export function ensureSecretsDir(home: string, connectionId?: string): string {
  const root = secretsRoot(home)
  mkdirSync(root, { recursive: true })
  chmodSync(root, DIR_MODE)
  if (!connectionId) return root
  const dir = secretsDir(home, connectionId)
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, DIR_MODE)
  return dir
}

function parseCookies(raw: unknown): StoredCookie[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: StoredCookie[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return undefined
    const c = entry as Record<string, unknown>
    if (typeof c.name !== "string" || c.name.length === 0) return undefined
    if (typeof c.value !== "string") return undefined
    if (typeof c.domain !== "string" || c.domain.length === 0) return undefined
    const path = typeof c.path === "string" && c.path.length > 0 ? c.path : "/"
    const cookie: StoredCookie = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path,
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

/** Read cookies for a connection, or undefined when missing/invalid. */
export function readCookies(
  home: string,
  connectionId: string
): StoredCookie[] | undefined {
  const raw = secretStoreFor(home).get(cookiesKey(connectionId))
  if (raw === null) return undefined
  try {
    return parseCookies(JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

/** True when cookies.json exists and parses to a non-empty list. */
export function isSignedIn(home: string, connectionId: string): boolean {
  const cookies = readCookies(home, connectionId)
  return cookies !== undefined && cookies.length > 0
}

/**
 * Write cookies.json (0600) under secrets/<id>/ (0700). Only this module
 * and browser sign-in write under secrets/ (DES-026).
 */
export function writeCookies(
  home: string,
  connectionId: string,
  cookies: StoredCookie[]
): void {
  const parsed = parseCookies(cookies)
  if (!parsed) throw new Error("invalid cookies")
  ensureSecretsDir(home, connectionId)
  secretStoreFor(home).set(
    cookiesKey(connectionId),
    `${JSON.stringify(parsed, null, 2)}\n`
  )
}

/**
 * Delete secrets/<connectionId>/ (cookies + profile). Library data is
 * untouched. Marks the connection signed out (DES-026).
 */
export function removeSignIn(home: string, connectionId: string): void {
  secretStoreFor(home).delete(cookiesKey(connectionId))
  const dir = secretsDir(home, connectionId)
  if (!existsSync(dir)) return
  rmSync(dir, { recursive: true, force: true })
}

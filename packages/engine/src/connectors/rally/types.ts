import type { StoredCookie } from "../../secrets.ts"

export type RallyFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>

export type RallyJson = Record<string, unknown>

export type RallyClientOptions = {
  baseUrl: string
  cookies: StoredCookie[]
  fetchFn?: RallyFetch
}

const DEFAULT_BASE = "https://rally1.rallydev.com"

/** Rally host from connection scope (url or domain). */
export function rallyBaseUrl(scope: Record<string, string>): string {
  const raw = scope.url?.trim() || scope.domain?.trim()
  if (!raw) return DEFAULT_BASE
  try {
    const href = raw.includes("://") ? raw : `https://${raw}`
    const u = new URL(href)
    return `${u.protocol}//${u.host}`
  } catch {
    return DEFAULT_BASE
  }
}

export function cookieHeader(cookies: StoredCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ")
}

export function typeNameForKind(
  kind: string
): "HierarchicalRequirement" | "Defect" {
  if (kind === "defect") return "Defect"
  if (kind === "story") return "HierarchicalRequirement"
  throw new Error(`rally connector only pulls story or defect, got ${kind}`)
}

export function pathForKind(kind: string): string {
  return kind === "defect" ? "defect" : "hierarchicalrequirement"
}

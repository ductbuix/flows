import type { BlobStore } from "@workspace/core"

export const FLOWS_BLOB_SCHEME = "flows-blob"

/** Privileges for `protocol.registerSchemesAsPrivileged` (before app ready). */
export const FLOWS_BLOB_PRIVILEGES = {
  scheme: FLOWS_BLOB_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    bypassCSP: true,
    corsEnabled: true,
  },
} as const

/**
 * Id from `flows-blob://{id}` (DES-040). Rejects empty, path-like, or
 * traversal ids so out-of-scope requests never hit the store.
 */
export function parseFlowsBlobId(requestUrl: string): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  if (url.protocol !== `${FLOWS_BLOB_SCHEME}:`) return null
  const fromHost = url.hostname
  const fromPath = url.pathname.replace(/^\/+/, "").split("/")[0] ?? ""
  const id = fromHost || fromPath
  if (!id) return null
  if (id.includes("..") || id.includes("/") || id.includes("\\")) return null
  if (url.pathname.includes("..")) return null
  // Host form must not carry an extra path segment (scope escape).
  if (fromHost && fromPath && fromPath !== "") return null
  return id
}

/** Stream the blob or 404 for unknown / out-of-scope ids. */
export async function flowsBlobResponse(
  requestUrl: string,
  store: BlobStore,
  mime = "application/octet-stream"
): Promise<Response> {
  const id = parseFlowsBlobId(requestUrl)
  if (!id) return new Response(null, { status: 404 })
  const body = await store.open(id)
  if (!body) return new Response(null, { status: 404 })
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": mime },
  })
}

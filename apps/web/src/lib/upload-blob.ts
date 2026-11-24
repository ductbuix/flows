import type { FlowsClient } from "@workspace/sdk"

export type UploadedBlob = {
  id: string
  name: string
  size: number
  mime: string
}

async function fcpToken(): Promise<string> {
  const embedded = window.__FLOWS_FCP__
  if (embedded?.token) return embedded.token
  const res = await fetch("/fcp/bootstrap")
  if (!res.ok) throw new Error("Could not load FCP bootstrap for blob upload")
  const body = (await res.json()) as { token?: string }
  if (!body.token) throw new Error("FCP bootstrap has no token")
  return body.token
}

/**
 * PUT a blob via the daemon `/blobs` proxy (DES-040). Requires
 * `engineCapabilities.blobs.http` from initialize.
 */
export async function uploadBlob(
  client: FlowsClient,
  opts: {
    scope: string
    name: string
    body: Blob | ArrayBuffer | string
    mime?: string
  }
): Promise<UploadedBlob> {
  const init = await client.ready
  if (!init.engineCapabilities.blobs?.http) {
    throw new Error("Blob upload is not available on this host")
  }
  const token = await fcpToken()
  const params = new URLSearchParams({
    token,
    scope: opts.scope,
    name: opts.name,
  })
  const res = await fetch(`/blobs?${params}`, {
    method: "PUT",
    headers: { "content-type": opts.mime ?? "application/octet-stream" },
    body: opts.body,
  })
  if (!res.ok) {
    throw new Error(`Blob upload failed (${res.status})`)
  }
  return (await res.json()) as UploadedBlob
}

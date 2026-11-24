import { protocol } from "electron"
import { createNodeBlobStore } from "@workspace/adapters-node"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  FLOWS_BLOB_PRIVILEGES,
  FLOWS_BLOB_SCHEME,
  flowsBlobResponse,
  parseFlowsBlobId,
} from "./flows-blob-protocol.ts"

/** Call before `app.whenReady` so the renderer can fetch `flows-blob://`. */
export function registerFlowsBlobScheme(): void {
  protocol.registerSchemesAsPrivileged([FLOWS_BLOB_PRIVILEGES])
}

function mimeFor(root: string, id: string): string {
  const metaFile = join(root, "meta", `${id}.json`)
  if (!existsSync(metaFile)) return "application/octet-stream"
  try {
    const meta = JSON.parse(readFileSync(metaFile, "utf8")) as { mime?: string }
    return meta.mime || "application/octet-stream"
  } catch {
    return "application/octet-stream"
  }
}

/** Serve BlobStore files under `home/blobs` via `flows-blob://{id}` (DES-040). */
export function installFlowsBlobProtocol(home: string): void {
  const root = join(home, "blobs")
  const store = createNodeBlobStore({ root })
  protocol.handle(FLOWS_BLOB_SCHEME, (request) => {
    const id = parseFlowsBlobId(request.url)
    const mime = id ? mimeFor(root, id) : "application/octet-stream"
    return flowsBlobResponse(request.url, store, mime)
  })
}

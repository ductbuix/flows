import { join } from "node:path"
import { createNodeBlobStore } from "../blob-store.ts"
import type { BlobStore } from "@workspace/core/ports"

let store: BlobStore | null = null

export function getBlobStore(): BlobStore {
  if (!store) throw new Error("BlobStore not configured")
  return store
}

export function setBlobStore(next: BlobStore): void {
  store = next
}

/** Point the module store at a Node BlobStore under `home/blobs`. */
export function ensureBlobStore(home: string): BlobStore {
  store = createNodeBlobStore({ root: join(home, "blobs") })
  return store
}

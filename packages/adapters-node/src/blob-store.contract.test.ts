import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach } from "vitest"
import { describeBlobStoreContract } from "@workspace/core/testing/blob-store.contract"
import { createFakeBlobStore } from "@workspace/core/testing"
import { createNodeBlobStore } from "./blob-store.ts"

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

describeBlobStoreContract("BlobStore", [
  ["fake", () => createFakeBlobStore()],
  [
    "node",
    () => {
      const root = mkdtempSync(join(tmpdir(), "flowapp-blobs-"))
      temps.push(root)
      return createNodeBlobStore({ root })
    },
  ],
])

import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach } from "vitest"
import { describeDocumentStoreContract } from "@workspace/core/testing/document-store.contract"
import { createFakeDocumentStore } from "@workspace/core/testing"
import { createNodeDocumentStore } from "./document-store.ts"

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

describeDocumentStoreContract("DocumentStore", [
  ["fake", () => createFakeDocumentStore()],
  [
    "node",
    () => {
      const root = mkdtempSync(join(tmpdir(), "flowapp-docstore-"))
      temps.push(root)
      return createNodeDocumentStore({ root })
    },
  ],
])

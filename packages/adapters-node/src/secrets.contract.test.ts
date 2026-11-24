import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach } from "vitest"
import { describeSecretStoreContract } from "@workspace/core/testing/secret-store.contract"
import { createFakeSecretStore } from "@workspace/core/testing"
import { createNodeSecretStore } from "./secrets.ts"

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

describeSecretStoreContract("SecretStore", [
  ["fake", () => createFakeSecretStore()],
  [
    "node",
    () => {
      const root = mkdtempSync(join(tmpdir(), "flowapp-secrets-"))
      temps.push(root)
      return createNodeSecretStore({ root })
    },
  ],
])

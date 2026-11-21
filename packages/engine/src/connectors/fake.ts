import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { ConnectionCheckResult } from "@workspace/shared"
import type {
  Connector,
  ConnectorChangeSet,
  ConnectorPublishResult,
} from "./types.ts"

/**
 * Test-only connector. Pull writes a small file; check/pull can fail when
 * scope flags are set (BL-042 / BL-043).
 */
export const fakeConnector: Connector = {
  id: "fake",
  describe() {
    return {
      id: "fake",
      entityKinds: ["item"],
      scopeFields: ["label", "ambient", "failPull", "signedOut"],
      signInMethods: ["cli", "mcp", "cookies"],
    }
  },
  async check(connection): Promise<ConnectionCheckResult> {
    if (connection.scope.signedOut === "1") {
      return { ok: false, message: "fake signed out" }
    }
    const ambient = connection.scope.ambient
    if (ambient) {
      return {
        ok: true,
        message: "fake sign-in ok",
        ambientLogin: ambient,
      }
    }
    return { ok: true, message: "fake sign-in ok" }
  },
  async pull(input) {
    if (input.connection.scope.signedOut === "1") {
      throw new Error("signed out")
    }
    const fail = input.connection.scope.failPull
    if (fail) throw new Error(fail)
    mkdirSync(input.destDir, { recursive: true })
    const body = input.connection.scope.label ?? input.entityId
    writeFileSync(join(input.destDir, "data.txt"), body, "utf8")
  },
  async diff(input): Promise<ConnectorChangeSet> {
    return {
      v: 1,
      connection: input.connection.id,
      base: "none",
      ops: [],
    }
  },
  async publish(): Promise<ConnectorPublishResult> {
    return { status: "rejected", message: "fake publish is not implemented" }
  },
}

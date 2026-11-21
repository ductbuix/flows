import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { ConnectionCheckResult } from "@workspace/shared"
import { isSignedIn, readCookies } from "../secrets.ts"
import type {
  Connector,
  ConnectorChangeSet,
  ConnectorPublishResult,
} from "./types.ts"

/**
 * Test-only connector. Cookie sign-in reads secrets only in check/pull/
 * publish; nothing secret is written to the library (BL-042 / BL-053).
 */
export const fakeConnector: Connector = {
  id: "fake",
  describe() {
    return {
      id: "fake",
      entityKinds: ["item"],
      scopeFields: ["label", "ambient", "domain", "url"],
      signInMethods: ["cli", "mcp", "cookies"],
    }
  },
  async check(connection, home): Promise<ConnectionCheckResult> {
    if (connection.signIn === "cookies") {
      if (!isSignedIn(home, connection.id)) {
        return { ok: false, message: "not signed in" }
      }
      return { ok: true, message: "fake cookie sign-in ok" }
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
    if (input.connection.signIn === "cookies") {
      const cookies = readCookies(input.home, input.connection.id)
      if (!cookies || cookies.length === 0) {
        throw new Error("not signed in")
      }
    }
    // Pull body is BL-043; write a non-secret marker for leak tests.
    mkdirSync(input.destDir, { recursive: true })
    writeFileSync(
      join(input.destDir, "item.json"),
      `${JSON.stringify({
        id: input.entityId,
        kind: input.entityKind,
        connection: input.connection.id,
      })}\n`,
      "utf8"
    )
  },
  async diff(input): Promise<ConnectorChangeSet> {
    return {
      v: 1,
      connection: input.connection.id,
      base: "none",
      ops: [],
    }
  },
  async publish(connection, _changeSet, home): Promise<ConnectorPublishResult> {
    if (connection.signIn === "cookies") {
      const cookies = readCookies(home, connection.id)
      if (!cookies || cookies.length === 0) {
        return { status: "rejected", message: "not signed in" }
      }
    }
    return { status: "rejected", message: "fake publish is not implemented" }
  },
}

import type { ConnectionCheckResult } from "@workspace/shared"
import type {
  Connector,
  ConnectorChangeSet,
  ConnectorPublishResult,
} from "./types.ts"

/**
 * Test-only connector. Nothing is pulled or published; check can report
 * an ambient login when `scope.ambient` is set (BL-042).
 */
export const fakeConnector: Connector = {
  id: "fake",
  describe() {
    return {
      id: "fake",
      entityKinds: ["item"],
      scopeFields: ["label", "ambient"],
      signInMethods: ["cli", "mcp", "cookies"],
    }
  },
  async check(connection): Promise<ConnectionCheckResult> {
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
  async pull() {
    // Pull is BL-043; fake writes nothing.
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

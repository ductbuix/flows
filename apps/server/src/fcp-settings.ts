import {
  createNodeCliStatusPort,
  createNodeMcpTrustPort,
} from "@workspace/adapters-node"
import type { TrustStatus } from "@workspace/contracts"
import {
  createSettingsBindings,
  type AppTrustPort,
  type SettingsBindings,
} from "@workspace/core"
import type { Host } from "@workspace/adapters-node"

/** Always-trust via engine settings table via adapters-node host (BL-214). */
function engineTrustPort(engine: Host): AppTrustPort {
  function status(): TrustStatus {
    const trust = engine.trustDecision()
    return {
      trust,
      homeRealpath: engine.homeRealpath(),
      alwaysTrusted: trust === "always",
    }
  }
  return {
    getTrust: status,
    setTrust(grant) {
      if (grant === "always") engine.setAlwaysTrust()
      else engine.revokeAlwaysTrust()
      return status()
    },
  }
}

/** settings/* FCP bindings (CLI probe, app trust, MCP allow) for BL-210. */
export function createSettingsFcp(engine: Host): SettingsBindings {
  return createSettingsBindings({
    cli: createNodeCliStatusPort(),
    trust: engineTrustPort(engine),
    mcp: createNodeMcpTrustPort(engine.home),
  })
}

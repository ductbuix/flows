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
import type { Engine } from "@workspace/engine"

/** Always-trust via engine settings table until BL-214 moves it. */
function engineTrustPort(engine: Engine): AppTrustPort {
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
export function createSettingsFcp(engine: Engine): SettingsBindings {
  return createSettingsBindings({
    cli: createNodeCliStatusPort(),
    trust: engineTrustPort(engine),
    mcp: createNodeMcpTrustPort(engine.home),
  })
}

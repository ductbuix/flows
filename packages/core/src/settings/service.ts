import {
  settingsCliStatusMethod,
  settingsGetTrustMethod,
  settingsListMcpTrustMethod,
  settingsSetMcpTrustMethod,
  settingsSetTrustMethod,
} from "@workspace/contracts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { SettingsPorts } from "./ports.ts"

export type SettingsBindings = Pick<
  MethodBindings,
  | "settings/cli_status"
  | "settings/get_trust"
  | "settings/set_trust"
  | "settings/list_mcp_trust"
  | "settings/set_mcp_trust"
>

/** FCP settings/* bindings over CliStatus, AppTrust and McpTrust ports (BL-210). */
export function createSettingsBindings(ports: SettingsPorts): SettingsBindings {
  return {
    "settings/cli_status": defineBinding(settingsCliStatusMethod, async () => ({
      clis: [...(await ports.cli.listCliStatus())],
    })),
    "settings/get_trust": defineBinding(settingsGetTrustMethod, () =>
      ports.trust.getTrust()
    ),
    "settings/set_trust": defineBinding(settingsSetTrustMethod, (params) =>
      ports.trust.setTrust(params.grant)
    ),
    "settings/list_mcp_trust": defineBinding(settingsListMcpTrustMethod, () => ({
      servers: [...ports.mcp.listServers()],
    })),
    "settings/set_mcp_trust": defineBinding(
      settingsSetMcpTrustMethod,
      (params) => ({
        servers: [...ports.mcp.setGrant(params.key, params.grant)],
      })
    ),
  }
}

import type {
  CliInfo,
  McpTrustEntry,
  TrustDecision,
  TrustStatus,
} from "@workspace/contracts"

/** Probe installed agent CLIs (DES-024). */
export type CliStatusPort = {
  listCliStatus(): Promise<readonly CliInfo[]> | readonly CliInfo[]
}

/** Always-trust for the app home (DES-019). Engine-backed until BL-214. */
export type AppTrustPort = {
  getTrust(): TrustStatus
  setTrust(grant: "always" | "none"): TrustStatus
}

/** MCP server allow list (DES-026). */
export type McpTrustPort = {
  listServers(): readonly McpTrustEntry[]
  setGrant(key: string, grant: "once" | "always" | "none"): readonly McpTrustEntry[]
}

export type SettingsPorts = {
  cli: CliStatusPort
  trust: AppTrustPort
  mcp: McpTrustPort
}

export type { CliInfo, McpTrustEntry, TrustDecision, TrustStatus }

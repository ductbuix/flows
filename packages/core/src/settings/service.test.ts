import {
  settingsCliStatusResultSchema,
  settingsGetTrustResultSchema,
  settingsListMcpTrustResultSchema,
  settingsSetMcpTrustResultSchema,
  settingsSetTrustResultSchema,
  type CliInfo,
  type McpTrustEntry,
  type TrustStatus,
} from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import type { SettingsPorts } from "./ports.ts"
import { createSettingsBindings } from "./service.ts"

function linkedClient(ports: SettingsPorts): RpcPeer {
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, createSettingsBindings(ports), {
    signal: new AbortController().signal,
  })
  return client
}

function fakePorts(): SettingsPorts {
  let servers: McpTrustEntry[] = []
  let trustStatus: TrustStatus = {
    trust: "none",
    homeRealpath: "/tmp/home",
    alwaysTrusted: false,
  }
  const clis: CliInfo[] = [
    { id: "claude", installed: true, version: "1.0.0" },
    { id: "cursor", installed: false, version: null },
  ]
  return {
    cli: { listCliStatus: () => clis },
    trust: {
      getTrust: () => trustStatus,
      setTrust(grant) {
        trustStatus =
          grant === "always"
            ? {
                trust: "always",
                homeRealpath: trustStatus.homeRealpath,
                alwaysTrusted: true,
              }
            : {
                trust: "none",
                homeRealpath: trustStatus.homeRealpath,
                alwaysTrusted: false,
              }
        return trustStatus
      },
    },
    mcp: {
      listServers: () => servers,
      setGrant(key, grant) {
        if (grant === "none") {
          servers = servers.filter((s) => s.key !== key)
        } else if (grant === "always") {
          servers = [
            ...servers.filter((s) => s.key !== key),
            { key, trustedAt: "2026-01-01T00:00:00.000Z" },
          ]
        }
        return servers
      },
    },
  }
}

describe("settings FCP", () => {
  it("returns cli status, trust and mcp allow list", async () => {
    const client = linkedClient(fakePorts())

    const cli = settingsCliStatusResultSchema.parse(
      await client.request("settings/cli_status", {})
    )
    expect(cli.clis).toEqual([
      { id: "claude", installed: true, version: "1.0.0" },
      { id: "cursor", installed: false, version: null },
    ])

    const before = settingsGetTrustResultSchema.parse(
      await client.request("settings/get_trust", {})
    )
    expect(before.alwaysTrusted).toBe(false)

    const trusted = settingsSetTrustResultSchema.parse(
      await client.request("settings/set_trust", { grant: "always" })
    )
    expect(trusted.alwaysTrusted).toBe(true)

    const revoked = settingsSetTrustResultSchema.parse(
      await client.request("settings/set_trust", { grant: "none" })
    )
    expect(revoked.alwaysTrusted).toBe(false)

    const empty = settingsListMcpTrustResultSchema.parse(
      await client.request("settings/list_mcp_trust", {})
    )
    expect(empty.servers).toEqual([])

    const allowed = settingsSetMcpTrustResultSchema.parse(
      await client.request("settings/set_mcp_trust", {
        key: "npx demo",
        grant: "always",
      })
    )
    expect(allowed.servers).toEqual([
      { key: "npx demo", trustedAt: "2026-01-01T00:00:00.000Z" },
    ])

    const cleared = settingsSetMcpTrustResultSchema.parse(
      await client.request("settings/set_mcp_trust", {
        key: "npx demo",
        grant: "none",
      })
    )
    expect(cleared.servers).toEqual([])
  })
})

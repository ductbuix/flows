import { useState } from "react"
import type { CliInfo, McpTrustEntry } from "@workspace/contracts"
import {
  useFlowsClient,
  useOptionalFlowsClient,
  useQuery,
} from "@workspace/sdk-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { FieldDescription, FieldGroup } from "@workspace/ui/components/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"
import { mono } from "@/components/data/mono"
import { PageSection } from "@/components/page"
import { SettingsMcpSection } from "./SettingsMcpSection"

export function SettingsTrustBody() {
  const existing = useOptionalFlowsClient()
  if (!existing) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="settings-fcp-wait"
      >
        Connecting to the engine for CLI and trust settings…
      </p>
    )
  }
  return <SettingsTrustSections />
}

function SettingsTrustSections() {
  const client = useFlowsClient()
  const cliQ = useQuery("settings/cli_status", {}, { topics: [] })
  const trustQ = useQuery("settings/get_trust", {}, { topics: [] })
  const mcpQ = useQuery("settings/list_mcp_trust", {}, { topics: [] })
  const [trustOverride, setTrustOverride] = useState<{
    alwaysTrusted: boolean
    homeRealpath: string
  } | null>(null)
  const [mcpOverride, setMcpOverride] = useState<McpTrustEntry[] | null>(null)
  const [busyTrust, setBusyTrust] = useState(false)
  const [revokingMcp, setRevokingMcp] = useState<string | null>(null)

  const clis: CliInfo[] | null = cliQ.data?.clis ?? null
  const alwaysTrusted =
    trustOverride?.alwaysTrusted ?? trustQ.data?.alwaysTrusted ?? null
  const homeRealpath =
    trustOverride?.homeRealpath ?? trustQ.data?.homeRealpath ?? null
  const servers = mcpOverride ?? mcpQ.data?.servers ?? null
  const trustLoaded = trustQ.data !== undefined || trustOverride !== null

  async function onSetTrust(grant: "always" | "none") {
    setBusyTrust(true)
    try {
      const next = await client.call("settings/set_trust", { grant })
      setTrustOverride({
        alwaysTrusted: next.alwaysTrusted,
        homeRealpath: next.homeRealpath,
      })
      toast.success(
        grant === "always" ? "Always-trust enabled" : "Always-trust revoked"
      )
    } catch {
      toast.error(
        grant === "always"
          ? "Could not enable always-trust"
          : "Could not revoke always-trust"
      )
    } finally {
      setBusyTrust(false)
    }
  }

  async function onRevokeMcp(key: string) {
    setRevokingMcp(key)
    try {
      const next = await client.call("settings/set_mcp_trust", {
        key,
        grant: "none",
      })
      setMcpOverride(next.servers)
      toast.success("MCP allow revoked")
    } catch {
      toast.error("Could not revoke MCP allow")
    } finally {
      setRevokingMcp(null)
    }
  }

  return (
    <FieldGroup className="gap-6">
      <PageSection title="Agent CLIs">
        <FieldDescription>
          Read-only. The app never writes CLI settings files.
        </FieldDescription>
        {!clis ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <ItemGroup data-testid="cli-status-list">
            {clis.map((cli) => (
              <Item
                key={cli.id}
                variant="outline"
                data-testid={`cli-${cli.id}`}
              >
                <ItemContent>
                  <ItemTitle className={mono}>{cli.id}</ItemTitle>
                  <ItemDescription>
                    {cli.installed
                      ? (cli.version ?? "installed")
                      : "Not found on PATH"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant={cli.installed ? "secondary" : "outline"}>
                    {cli.installed ? "installed" : "missing"}
                  </Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </PageSection>

      <PageSection title="Always-trust">
        <Item variant="outline" data-testid="trust-settings">
          <ItemContent>
            <ItemTitle>Agent CLI trust for this app home</ItemTitle>
            <ItemDescription>
              {!trustLoaded || alwaysTrusted === null
                ? "Loading…"
                : alwaysTrusted
                  ? `Trusted${homeRealpath ? ` (${homeRealpath})` : ""}`
                  : "Not always trusted. You will be asked before agent runs."}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {alwaysTrusted ? (
              <Button
                size="sm"
                variant="outline"
                data-testid="trust-revoke"
                disabled={busyTrust}
                onClick={() => void onSetTrust("none")}
              >
                Revoke
              </Button>
            ) : trustLoaded ? (
              <Button
                size="sm"
                variant="outline"
                data-testid="trust-always"
                disabled={busyTrust}
                onClick={() => void onSetTrust("always")}
              >
                Trust always
              </Button>
            ) : null}
          </ItemActions>
        </Item>
      </PageSection>

      <SettingsMcpSection
        servers={servers}
        revokingKey={revokingMcp}
        onRevoke={(key) => void onRevokeMcp(key)}
      />
    </FieldGroup>
  )
}

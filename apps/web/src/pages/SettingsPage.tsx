import { useEffect, useState } from "react"
import type { CliInfo, McpTrustEntry } from "@workspace/shared"
import { cliStatusSchema, mcpTrustStatusSchema } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@workspace/ui/components/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"
import { Page, PageSection, PageTitle } from "@/components/page"
import { useTheme } from "@/components/theme-provider"
import { api } from "@/lib/api"
import { fetchTrustStatus, revokeTrust } from "@/lib/run-actions"
import { SettingsMcpSection } from "./SettingsMcpSection"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [clis, setClis] = useState<CliInfo[] | null>(null)
  const [alwaysTrusted, setAlwaysTrusted] = useState(false)
  const [homeRealpath, setHomeRealpath] = useState<string | null>(null)
  const [mcpServers, setMcpServers] = useState<McpTrustEntry[] | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [revokingMcp, setRevokingMcp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [cliRes, trust, mcpRes] = await Promise.all([
          api["cli-status"].$get(),
          fetchTrustStatus(),
          api["mcp-trust"].$get(),
        ])
        if (!cliRes.ok) throw new Error("cli status failed")
        if (!mcpRes.ok) throw new Error("mcp trust failed")
        const status = cliStatusSchema.parse(await cliRes.json())
        const mcp = mcpTrustStatusSchema.parse(await mcpRes.json())
        if (!alive) return
        setClis(status.clis)
        setMcpServers(mcp.servers)
        if (trust.ok) {
          setAlwaysTrusted(trust.data.alwaysTrusted)
          setHomeRealpath(trust.data.homeRealpath)
        }
      } catch {
        if (alive) setError("Could not load settings")
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function onRevokeTrust() {
    setRevoking(true)
    const result = await revokeTrust()
    setRevoking(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setAlwaysTrusted(false)
    toast.success("Always-trust revoked")
  }

  async function onRevokeMcp(key: string) {
    setRevokingMcp(key)
    try {
      const res = await api["mcp-trust"].$put({
        json: { key, grant: "none" },
      })
      if (!res.ok) {
        toast.error("Could not revoke MCP allow")
        return
      }
      const body = mcpTrustStatusSchema.parse(await res.json())
      setMcpServers(body.servers)
      toast.success("MCP allow revoked")
    } finally {
      setRevokingMcp(null)
    }
  }

  return (
    <Page crumbs={[{ label: "Settings" }]} data-testid="settings-page">
      <PageTitle
        title="Settings"
        description="Theme, agent CLIs, always-trust and allowed MCP servers."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <FieldGroup className="max-w-xl gap-6">
          <PageSection title="Theme">
            <Field>
              <ToggleGroup
                value={[theme]}
                onValueChange={(v) => {
                  const next = v[0]
                  if (next === "light" || next === "dark" || next === "system")
                    setTheme(next)
                }}
                variant="outline"
                data-testid="theme-toggle"
              >
                <ToggleGroupItem value="light">Light</ToggleGroupItem>
                <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
                <ToggleGroupItem value="system">System</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription data-testid="theme-shortcut-hint">
                Default is light. Press <Kbd>d</Kbd> to toggle light and dark.
              </FieldDescription>
            </Field>
          </PageSection>

          <PageSection title="Agent CLIs">
            <FieldDescription>
              Read-only. The app never writes CLI settings files. Model and
              effort appear here when that API exists.
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
                      <ItemTitle className="font-mono">{cli.id}</ItemTitle>
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
                  {alwaysTrusted
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
                    disabled={revoking}
                    onClick={() => void onRevokeTrust()}
                  >
                    Revoke
                  </Button>
                ) : null}
              </ItemActions>
            </Item>
          </PageSection>

          <SettingsMcpSection
            servers={mcpServers}
            revokingKey={revokingMcp}
            onRevoke={(key) => void onRevokeMcp(key)}
          />
        </FieldGroup>
      )}
    </Page>
  )
}

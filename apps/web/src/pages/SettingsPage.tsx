import { useEffect, useState } from "react"
import type { CliInfo } from "@workspace/shared"
import { cliStatusSchema } from "@workspace/shared"
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
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { Section } from "@/components/Section"
import { useTheme } from "@/components/theme-provider"
import { api } from "@/lib/api"
import { fetchTrustStatus, revokeTrust } from "@/lib/run-actions"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [clis, setClis] = useState<CliInfo[] | null>(null)
  const [alwaysTrusted, setAlwaysTrusted] = useState(false)
  const [homeRealpath, setHomeRealpath] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [cliRes, trust] = await Promise.all([
          api["cli-status"].$get(),
          fetchTrustStatus(),
        ])
        if (!cliRes.ok) throw new Error("cli status failed")
        const status = cliStatusSchema.parse(await cliRes.json())
        if (!alive) return
        setClis(status.clis)
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader crumbs={[{ label: "Settings" }]} />
      <div
        className="flex flex-1 flex-col gap-6 overflow-auto p-4"
        data-testid="settings-page"
      >
        <PageTitle
          title="Settings"
          description="Theme, agent CLIs and always-trust for this machine."
        />
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <FieldGroup className="max-w-xl gap-6">
            <Section title="Theme">
              <Field>
                <ToggleGroup
                  value={[theme]}
                  onValueChange={(v) => {
                    const next = v[0]
                    if (
                      next === "light" ||
                      next === "dark" ||
                      next === "system"
                    )
                      setTheme(next)
                  }}
                  variant="outline"
                  size="sm"
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
            </Section>

            <Section title="Agent CLIs">
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
                        <Badge
                          variant={cli.installed ? "secondary" : "outline"}
                        >
                          {cli.installed ? "installed" : "missing"}
                        </Badge>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              )}
            </Section>

            <Section title="Always-trust">
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
            </Section>
          </FieldGroup>
        )}
      </div>
    </div>
  )
}

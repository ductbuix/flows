import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"
import {
  connectionDetailSchema,
  connectionSchema,
  libraryListSchema,
  type ConnectionDetail,
  type LibraryEntity,
  type RefreshRule,
} from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"
import { McpTrustDialog } from "@/components/McpTrustDialog"
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { PublishPolicyBadge } from "@/components/PublishPolicyBadge"
import { Section } from "@/components/Section"
import { api } from "@/lib/api"
import { connectionsPath } from "@/lib/paths"
import { ConnectionLocalData } from "./ConnectionLocalData"
import { ConnectionRefreshField } from "./ConnectionRefreshField"
import { ConnectionSignInSection } from "./ConnectionSignInSection"
import { ConnectionUsedBy } from "./ConnectionUsedBy"
import { useConnectionSignIn } from "./useConnectionSignIn"

function mcpKey(scope: Record<string, string>): string | null {
  return scope.command?.trim() || scope.url?.trim() || null
}

export function ConnectionPage() {
  const { connectionId = "" } = useParams()
  const [detail, setDetail] = useState<ConnectionDetail | null>(null)
  const [localData, setLocalData] = useState<LibraryEntity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadDetail = useCallback(async (): Promise<ConnectionDetail | null> => {
    const [connRes, libRes] = await Promise.all([
      api.connections[":id"].$get({ param: { id: connectionId } }),
      api.library.$get(),
    ])
    if (connRes.status === 404) {
      setError("Connection not found.")
      setDetail(null)
      return null
    }
    if (!connRes.ok) throw new Error("failed")
    const parsed = connectionDetailSchema.parse(await connRes.json())
    setDetail(parsed)
    setError(null)
    if (libRes.ok) {
      const lib = libraryListSchema.parse(await libRes.json())
      setLocalData(lib.entities.filter((e) => e.connection === connectionId))
    }
    return parsed
  }, [connectionId])

  const signIn = useConnectionSignIn(connectionId, async () => {
    await loadDetail()
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setError(null)
      try {
        const parsed = await loadDetail()
        if (!cancelled && parsed) await signIn.loadSignInState(parsed.scope)
      } catch {
        if (!cancelled) {
          setError("Could not load connection.")
          setDetail(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // Reload when the route id changes; sign-in helpers bind to that id.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [connectionId, loadDetail])

  async function saveRefresh(refresh: RefreshRule) {
    if (!detail) return
    setSaving(true)
    try {
      const { usedByWorkflows, usedByRuns, ...conn } = detail
      const body = connectionSchema.parse({ ...conn, refresh })
      const res = await api.connections[":id"].$put({
        param: { id: connectionId },
        json: body,
      })
      if (!res.ok) {
        toast.error("Could not update refresh rule")
        return
      }
      setDetail({ ...detail, refresh, usedByWorkflows, usedByRuns })
      toast.success("Refresh rule updated")
    } catch {
      toast.error("Could not update refresh rule")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        crumbs={[
          { label: "Connections", to: connectionsPath() },
          { label: detail?.name ?? connectionId },
        ]}
      />
      <div
        className="flex flex-1 flex-col gap-6 overflow-auto p-6"
        data-testid="connection-page"
      >
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <PageTitle
              title={detail.name}
              description={`${detail.connector} · ${detail.id}`}
              badge={
                <PublishPolicyBadge
                  policy={detail.policy}
                  data-testid="connection-policy"
                />
              }
            />
            <ConnectionSignInSection
              conn={detail}
              signedIn={signIn.signedIn}
              check={signIn.check}
              busy={signIn.busy}
              mcpAlwaysAllowed={signIn.mcpAlwaysAllowed}
              onSignIn={() => void signIn.signInWithBrowser()}
              onCheck={() => void signIn.checkAgain()}
              onRemoveSignIn={() => void signIn.removeSignIn()}
              onAllowMcp={() => signIn.setMcpDialogOpen(true)}
              onRevokeMcp={() => {
                const key = mcpKey(detail.scope)
                if (key) void signIn.revokeMcp(key, detail.scope)
              }}
            />
            {mcpKey(detail.scope) ? (
              <McpTrustDialog
                open={signIn.mcpDialogOpen}
                onOpenChange={signIn.setMcpDialogOpen}
                serverKey={mcpKey(detail.scope)!}
                pending={signIn.busy === "mcp"}
                onTrustOnce={() => {
                  const key = mcpKey(detail.scope)
                  if (key) void signIn.grantMcp(key, "once", detail.scope)
                }}
                onTrustAlways={() => {
                  const key = mcpKey(detail.scope)
                  if (key) void signIn.grantMcp(key, "always", detail.scope)
                }}
              />
            ) : null}
            <ConnectionLocalData entities={localData} />
            <ConnectionUsedBy
              workflows={detail.usedByWorkflows}
              runs={detail.usedByRuns}
            />
            <ConnectionRefreshField
              value={detail.refresh}
              disabled={saving}
              onChange={(refresh) => void saveRefresh(refresh)}
            />
            <Section title="Publish policy">
              <PublishPolicyBadge
                policy={detail.policy}
                data-testid="connection-policy-section"
              />
              <p className="text-sm text-muted-foreground">
                Policy is shown here; editing lands with publish UI.
              </p>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

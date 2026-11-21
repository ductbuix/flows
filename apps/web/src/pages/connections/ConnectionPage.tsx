import { useEffect, useState } from "react"
import { useParams } from "react-router"
import {
  connectionDetailSchema,
  connectionCheckResultSchema,
  connectionSchema,
  libraryListSchema,
  type ConnectionCheckResult,
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
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { PublishPolicyBadge } from "@/components/PublishPolicyBadge"
import { Section } from "@/components/Section"
import { api } from "@/lib/api"
import { connectionsPath } from "@/lib/paths"
import { ConnectionLocalData } from "./ConnectionLocalData"
import { ConnectionRefreshField } from "./ConnectionRefreshField"
import { ConnectionSignIn } from "./ConnectionSignIn"
import { ConnectionUsedBy } from "./ConnectionUsedBy"

export function ConnectionPage() {
  const { connectionId = "" } = useParams()
  const [detail, setDetail] = useState<ConnectionDetail | null>(null)
  const [check, setCheck] = useState<ConnectionCheckResult | null>(null)
  const [localData, setLocalData] = useState<LibraryEntity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setError(null)
    try {
      const [connRes, libRes] = await Promise.all([
        api.connections[":id"].$get({ param: { id: connectionId } }),
        api.library.$get(),
      ])
      if (connRes.status === 404) {
        setError("Connection not found.")
        setDetail(null)
        return
      }
      if (!connRes.ok) throw new Error("failed")
      const parsed = connectionDetailSchema.parse(await connRes.json())
      setDetail(parsed)
      if (libRes.ok) {
        const lib = libraryListSchema.parse(await libRes.json())
        setLocalData(
          lib.entities.filter((e) => e.connection === connectionId)
        )
      }
      const checkRes = await api.connections[":id"].check.$post({
        param: { id: connectionId },
      })
      if (checkRes.ok) {
        setCheck(connectionCheckResultSchema.parse(await checkRes.json()))
      }
    } catch {
      setError("Could not load connection.")
      setDetail(null)
    }
  }

  useEffect(() => {
    void load()
  }, [connectionId])

  async function checkAgain() {
    setChecking(true)
    try {
      const res = await api.connections[":id"].check.$post({
        param: { id: connectionId },
      })
      if (!res.ok) {
        toast.error("Check failed")
        return
      }
      setCheck(connectionCheckResultSchema.parse(await res.json()))
    } catch {
      toast.error("Check failed")
    } finally {
      setChecking(false)
    }
  }

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
            <ConnectionSignIn
              signIn={detail.signIn}
              check={check}
              checking={checking}
              onCheck={() => void checkAgain()}
            />
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

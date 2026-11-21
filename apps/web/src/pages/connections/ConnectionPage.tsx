import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"
import {
  connectionDetailSchema,
  connectionSchema,
  libraryListSchema,
  type ConnectionDetail,
  type LibraryEntity,
  type PublishPolicy,
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
import { api } from "@/lib/api"
import { connectionsPath } from "@/lib/paths"
import { ConnectionPageBody } from "./ConnectionPageBody"
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

  async function saveConnection(
    patch: { refresh?: RefreshRule; policy?: PublishPolicy },
    okMessage: string,
    errMessage: string
  ) {
    if (!detail) return
    setSaving(true)
    try {
      const { usedByWorkflows, usedByRuns, ...conn } = detail
      const body = connectionSchema.parse({ ...conn, ...patch })
      const res = await api.connections[":id"].$put({
        param: { id: connectionId },
        json: body,
      })
      if (!res.ok) {
        toast.error(errMessage)
        return
      }
      setDetail({ ...detail, ...patch, usedByWorkflows, usedByRuns })
      toast.success(okMessage)
    } catch {
      toast.error(errMessage)
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
          <ConnectionPageBody
            detail={detail}
            localData={localData}
            saving={saving}
            signIn={signIn}
            mcpKey={mcpKey(detail.scope)}
            onSaveRefresh={(refresh) =>
              void saveConnection(
                { refresh },
                "Refresh rule updated",
                "Could not update refresh rule"
              )
            }
            onSavePolicy={(policy) =>
              void saveConnection(
                { policy },
                "Publish policy updated",
                "Could not update publish policy"
              )
            }
          />
        )}
      </div>
    </div>
  )
}

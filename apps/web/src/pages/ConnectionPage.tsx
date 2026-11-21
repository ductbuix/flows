import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"
import {
  connectionBrowserSignInResultSchema,
  connectionCheckResultSchema,
  connectionSchema,
  connectionSignInStatusSchema,
  type Connection,
  type ConnectionCheckResult,
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
import { api } from "@/lib/api"
import { ConnectionSignInSection } from "@/pages/connection/ConnectionSignInSection"

export function ConnectionPage() {
  const { connectionId = "" } = useParams()
  const [conn, setConn] = useState<Connection | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [check, setCheck] = useState<ConnectionCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"sign-in" | "remove" | "check" | null>(null)

  const reload = useCallback(async () => {
    if (!connectionId) return
    const [connRes, signRes] = await Promise.all([
      api.connections[":id"].$get({ param: { id: connectionId } }),
      api.connections[":id"]["sign-in"].$get({
        param: { id: connectionId },
      }),
    ])
    if (!connRes.ok) {
      setError(connRes.status === 404 ? "Connection not found" : "Load failed")
      setConn(null)
      return
    }
    setError(null)
    setConn(connectionSchema.parse(await connRes.json()))
    if (signRes.ok) {
      setSignedIn(
        connectionSignInStatusSchema.parse(await signRes.json()).signedIn
      )
    }
  }, [connectionId])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        await reload()
      } catch {
        if (alive) setError("Could not load connection")
      }
    })()
    return () => {
      alive = false
    }
  }, [reload])

  async function onCheck() {
    if (!connectionId) return
    setBusy("check")
    try {
      const res = await api.connections[":id"].check.$post({
        param: { id: connectionId },
      })
      if (!res.ok) {
        toast.error("Check failed")
        return
      }
      const result = connectionCheckResultSchema.parse(await res.json())
      setCheck(result)
      toast.success(result.ok ? "Sign-in ok" : "Sign-in failed")
      await reload()
    } finally {
      setBusy(null)
    }
  }

  async function onSignIn() {
    if (!connectionId) return
    setBusy("sign-in")
    toast.message("Waiting for the browser window to close…")
    try {
      const res = await api.connections[":id"]["sign-in"].browser.$post({
        param: { id: connectionId },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string
        } | null
        toast.error(body?.message ?? "Browser sign-in failed")
        return
      }
      const result = connectionBrowserSignInResultSchema.parse(await res.json())
      setSignedIn(result.signedIn)
      setCheck(result.check)
      toast.success(
        result.signedIn ? "Signed in" : "Browser closed with no cookies"
      )
      await reload()
    } finally {
      setBusy(null)
    }
  }

  async function onRemoveSignIn() {
    if (!connectionId) return
    setBusy("remove")
    try {
      const res = await api.connections[":id"]["sign-in"].$delete({
        param: { id: connectionId },
      })
      if (!res.ok) {
        toast.error("Could not remove sign-in")
        return
      }
      setSignedIn(false)
      setCheck(null)
      toast.success("Sign-in removed")
      await reload()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        crumbs={[
          { label: "Connections", to: "/connections" },
          { label: conn?.name ?? connectionId },
        ]}
      />
      <div
        className="flex flex-1 flex-col gap-6 overflow-auto p-4"
        data-testid="connection-page"
      >
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !conn ? (
          <Skeleton className="h-24 w-full max-w-xl" />
        ) : (
          <>
            <PageTitle
              title={conn.name}
              description={`${conn.connector} · ${conn.id}`}
            />
            <ConnectionSignInSection
              conn={conn}
              signedIn={signedIn}
              check={check}
              busy={busy}
              onSignIn={() => void onSignIn()}
              onCheck={() => void onCheck()}
              onRemoveSignIn={() => void onRemoveSignIn()}
            />
          </>
        )}
      </div>
    </div>
  )
}

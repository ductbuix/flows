import { useEffect, useState, type ReactNode } from "react"
import {
  FlowsClientProvider,
  useOptionalFlowsClient,
} from "@workspace/sdk-react"
import type { FlowsClient } from "@workspace/sdk"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import { createAppClient } from "@/lib/create-app-client"

/** Connects one FlowsClient for the tree when main did not already provide one. */
export function FlowsClientGate({ children }: { children: ReactNode }) {
  const existing = useOptionalFlowsClient()
  const [client, setClient] = useState<FlowsClient | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) return
    let alive = true
    let created: FlowsClient | null = null
    void (async () => {
      try {
        created = await createAppClient()
        if (!created) throw new Error("Could not load FCP bootstrap")
        await created.ready
        if (!alive) {
          created.close()
          return
        }
        setClient(created)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      alive = false
      created?.close()
    }
  }, [existing])

  if (existing) return children

  if (error) {
    return (
      <Page crumbs={[{ label: "Connecting" }]} data-testid="fcp-error">
        <PageTitle title="Could not connect" />
        <Alert variant="destructive">
          <AlertTitle>Could not connect</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Page>
    )
  }

  if (!client) {
    return (
      <Page crumbs={[{ label: "Connecting" }]} data-testid="fcp-loading">
        <PageTitle title="Connecting…" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </Page>
    )
  }

  return <FlowsClientProvider client={client}>{children}</FlowsClientProvider>
}

import { useEffect, useState, type ReactNode } from "react"
import { FlowsClientProvider } from "@workspace/sdk-react"
import type { FlowsClient } from "@workspace/sdk"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import {
  createWebFlowsClient,
  loadFcpBootstrap,
} from "@/lib/fcp"

/** Connects one FlowsClient for the tree; shows loading/error until ready. */
export function FlowsClientGate({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<FlowsClient | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let created: FlowsClient | null = null
    void (async () => {
      try {
        const boot = await loadFcpBootstrap()
        created = createWebFlowsClient(boot)
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
  }, [])

  if (error) {
    return (
      <Page data-testid="fcp-error">
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
      <Page data-testid="fcp-loading">
        <PageTitle title="Connecting…" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </Page>
    )
  }

  return <FlowsClientProvider client={client}>{children}</FlowsClientProvider>
}

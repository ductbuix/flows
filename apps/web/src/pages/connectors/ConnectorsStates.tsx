import { Cable } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"

const crumbs = [{ label: "Connectors" }] as const

export function ConnectorsLoading() {
  return (
    <Page fill crumbs={[...crumbs]} data-testid="mock-connectors-page">
      <PageTitle title="Connectors" description="Loading connectors…" />
      <div className="flex flex-col gap-3" data-testid="connectors-loading">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    </Page>
  )
}

export function ConnectorsLoadError({ error }: { error: unknown }) {
  return (
    <Page fill crumbs={[...crumbs]} data-testid="mock-connectors-page">
      <PageTitle title="Connectors" description="Could not load connectors." />
      <Alert variant="destructive" data-testid="connectors-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    </Page>
  )
}

export function ConnectorsEmpty() {
  return (
    <Empty data-testid="connectors-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Cable />
        </EmptyMedia>
        <EmptyTitle>No connectors yet</EmptyTitle>
        <EmptyDescription>
          Add a connector so agents and scripts can reach an outside system.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

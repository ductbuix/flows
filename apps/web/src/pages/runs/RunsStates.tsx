import { Play } from "lucide-react"
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

const crumbs = [{ label: "Mockup", to: "/mock" }, { label: "Runs" }] as const

export function RunsLoading() {
  return (
    <Page crumbs={[...crumbs]} data-testid="mock-runs-page">
      <PageTitle title="Runs" description="Loading runs…" />
      <div className="space-y-3" data-testid="runs-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Page>
  )
}

export function RunsLoadError({ error }: { error: unknown }) {
  return (
    <Page crumbs={[...crumbs]} data-testid="mock-runs-page">
      <PageTitle title="Runs" description="Could not load runs." />
      <Alert variant="destructive" data-testid="runs-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    </Page>
  )
}

export function RunsEmpty() {
  return (
    <Empty className="ring-1 ring-foreground/10" data-testid="runs-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Play />
        </EmptyMedia>
        <EmptyTitle>No runs yet</EmptyTitle>
        <EmptyDescription>
          Start a run from a workflow. Finished and live runs show up here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

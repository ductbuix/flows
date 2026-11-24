import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"

const crumbs = [
  { label: "Mockup", to: "/mock" },
  { label: "Workflows" },
] as const

export function WorkflowsLoading() {
  return (
    <Page crumbs={[...crumbs]} data-testid="mock-workflows-page">
      <PageTitle title="Workflows" description="Loading workflows…" />
      <div className="space-y-3" data-testid="workflows-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Page>
  )
}

export function WorkflowsLoadError({ error }: { error: unknown }) {
  return (
    <Page crumbs={[...crumbs]} data-testid="mock-workflows-page">
      <PageTitle title="Workflows" description="Could not load workflows." />
      <Alert variant="destructive" data-testid="workflows-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    </Page>
  )
}

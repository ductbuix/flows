import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"

const crumbs = [{ label: "Workflows" }] as const

export function WorkflowsLoading() {
  return (
    <Page crumbs={[...crumbs]} data-testid="workflows-page">
      <PageTitle
        title="Workflows"
        description="Each workflow solves one type of task the same way every time."
      />
      <div className="space-y-3" data-testid="workflows-loading">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  )
}

export function WorkflowsLoadError({ error }: { error: unknown }) {
  return (
    <Page crumbs={[...crumbs]} data-testid="workflows-page">
      <PageTitle title="Workflows" description="Could not load workflows." />
      <Alert variant="destructive" data-testid="workflows-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    </Page>
  )
}

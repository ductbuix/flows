import { Inbox } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
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

const crumbs = [{ label: "Mockup", to: "/mock" }, { label: "Docket" }] as const

export function DocketLoading() {
  return (
    <Page fill crumbs={[...crumbs]} data-testid="docket-page">
      <PageTitle title="Docket" description="Loading board…" />
      <div className="flex gap-4" data-testid="docket-loading">
        <Skeleton className="h-80 w-72" />
        <Skeleton className="h-80 w-72" />
        <Skeleton className="h-80 w-72" />
      </div>
    </Page>
  )
}

export function DocketLoadError({ error }: { error: unknown }) {
  return (
    <Page fill crumbs={[...crumbs]} data-testid="docket-page">
      <PageTitle title="Docket" description="Could not load the board." />
      <Alert variant="destructive" data-testid="docket-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    </Page>
  )
}

export function DocketNoBoard({
  onCreate,
  actionError,
}: {
  onCreate: () => void
  actionError: string | null
}) {
  return (
    <Page
      fill
      crumbs={[...crumbs]}
      actions={
        <Button data-testid="docket-create-board" onClick={onCreate}>
          Create board
        </Button>
      }
      data-testid="docket-page"
    >
      <PageTitle
        title="Docket"
        description="Cards wrap tickets, files and notes."
      />
      <Empty data-testid="docket-empty-board">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>No board yet</EmptyTitle>
          <EmptyDescription>
            Create a board to start adding cards.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
    </Page>
  )
}

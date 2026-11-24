import { Library } from "lucide-react"
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

const crumbs = [{ label: "Library" }] as const

export function LibraryLoading() {
  return (
    <Page crumbs={[...crumbs]} data-testid="library-page">
      <PageTitle title="Library" description="Loading providers…" />
      <div className="flex flex-col gap-3" data-testid="library-loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    </Page>
  )
}

export function LibraryLoadError({ error }: { error: unknown }) {
  return (
    <Page crumbs={[...crumbs]} data-testid="library-page">
      <PageTitle title="Library" description="Could not load providers." />
      <Alert variant="destructive" data-testid="library-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    </Page>
  )
}

export function LibraryEmpty() {
  return (
    <Empty className="ring-1 ring-foreground/10" data-testid="library-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Library />
        </EmptyMedia>
        <EmptyTitle>No library items yet</EmptyTitle>
        <EmptyDescription>
          Add a repository, page or ticket so tasks have a local copy to read.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function LibraryProvidersEmpty() {
  return (
    <Empty data-testid="library-providers-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Library />
        </EmptyMedia>
        <EmptyTitle>No providers</EmptyTitle>
        <EmptyDescription>
          Add a preset or a custom provider so links can be recognised.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

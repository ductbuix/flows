import { Inbox } from "lucide-react"
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

const crumbs = [{ label: "Inbox" }] as const

export function InboxLoading() {
  return (
    <Page crumbs={[...crumbs]} data-testid="mock-inbox-page">
      <PageTitle title="Inbox" description="Loading inbox…" />
      <div
        className="flex max-w-2xl flex-col gap-3"
        data-testid="inbox-loading"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Page>
  )
}

export function InboxLoadError({ error }: { error: unknown }) {
  return (
    <Page crumbs={[...crumbs]} data-testid="mock-inbox-page">
      <PageTitle title="Inbox" description="Could not load the inbox." />
      <Alert variant="destructive" data-testid="inbox-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    </Page>
  )
}

export function InboxEmpty() {
  return (
    <Empty className="ring-1 ring-foreground/10" data-testid="inbox-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>Nothing needs you</EmptyTitle>
        <EmptyDescription>Approvals from runs show up here.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

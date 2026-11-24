import { useState } from "react"
import { useOptionalFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { InboxItemCard } from "./InboxItemCard"
import { InboxEmpty, InboxLoadError, InboxLoading } from "./InboxStates"

export function InboxPage() {
  const existing = useOptionalFlowsClient()
  if (existing) return <InboxPageInner />
  return (
    <FlowsClientGate>
      <InboxPageInner />
    </FlowsClientGate>
  )
}

function InboxPageInner() {
  const listQ = useQuery("inbox/list", {}, { topics: ["inbox"] })
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const items = listQ.data?.items ?? []
  const loading = listQ.loading && !listQ.data

  if (loading) return <InboxLoading />
  if (listQ.error && !listQ.data) return <InboxLoadError error={listQ.error} />

  return (
    <Page
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Inbox" }]}
      data-testid="mock-inbox-page"
    >
      <PageTitle
        title="Inbox"
        description="Runs waiting for you to approve or reject a step."
      />
      {(conflict || actionError) && (
        <Alert variant="destructive" data-testid="inbox-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not update"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "This item was already answered. Refresh to see what is left."
              : actionError}
          </AlertDescription>
        </Alert>
      )}
      <h2 className="font-heading text-base font-medium">
        Needs you
        <span className="ml-2 text-muted-foreground">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <InboxEmpty />
      ) : (
        <div className="flex max-w-2xl flex-col gap-3">
          {items.map((item) => (
            <InboxItemCard
              key={item.id}
              item={item}
              onConflict={() => {
                setActionError(null)
                setConflict(true)
              }}
              onError={(message) => {
                setConflict(false)
                setActionError(message)
              }}
            />
          ))}
        </div>
      )}
    </Page>
  )
}

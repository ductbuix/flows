import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { Paperclip } from "lucide-react"
import type { WorkItem, WorkItemAttachment } from "@workspace/shared"
import {
  workItemAttachmentListSchema,
  workItemDetailSchema,
} from "@workspace/shared"
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
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"
import { Page, PageSection, PageTitle } from "@/components/page"
import { WorkItemSourceBadge } from "@/components/data/WorkItemSourceBadge"
import { api } from "@/lib/api"
import { WorkItemContextSection } from "@/pages/WorkItemContextSection"
import { WorkItemNotesSection } from "@/pages/WorkItemNotesSection"
import { WorkItemRunsSection } from "@/pages/WorkItemRunsSection"
import { ActionButton } from "@/components/ActionButton"
import { TrustStartGate } from "@/components/TrustStartGate"
import { mono } from "@/components/data/mono"

type Loaded = {
  id: string
  item: WorkItem
  hash: string
  attachments: WorkItemAttachment[]
}

export function WorkItemPage() {
  const { workItemId } = useParams() as { workItemId: string }
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [errorFor, setErrorFor] = useState<{
    id: string
    message: string
  } | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [detailRes, filesRes] = await Promise.all([
        api.workitems[":id"].$get({ param: { id: workItemId } }),
        api.workitems[":id"].attachments.$get({ param: { id: workItemId } }),
      ])
      if (!alive) return
      if (!detailRes.ok) {
        setErrorFor({
          id: workItemId,
          message:
            detailRes.status === 404
              ? `Work item ${workItemId} was not found.`
              : "Could not load work item",
        })
        return
      }
      const detail = workItemDetailSchema.parse(await detailRes.json())
      const attachments = filesRes.ok
        ? workItemAttachmentListSchema.parse(await filesRes.json()).files
        : []
      setErrorFor(null)
      setLoaded({
        id: workItemId,
        item: detail.item,
        hash: detail.hash,
        attachments,
      })
    })()
    return () => {
      alive = false
    }
  }, [workItemId])

  function onStarted(runId: string) {
    toast.success(`Started run ${runId}`)
  }

  const match = loaded?.id === workItemId
  const item = match ? loaded.item : null
  const hash = match ? loaded.hash : null
  const attachments = match ? loaded.attachments : null
  const error = errorFor?.id === workItemId ? errorFor.message : null
  const loading = !match && !error

  const crumbs = [
    { label: "Work items", to: "/work-items" },
    { label: item?.title ?? workItemId },
  ] as const

  return (
    <TrustStartGate onStarted={(_wf, runId) => onStarted(runId)}>
      {({ begin, pending }) => (
        <Page
          crumbs={[...crumbs]}
          actions={
            item ? (
              <ActionButton
                data-testid="work-item-start"
                pending={pending}
                onClick={() =>
                  begin({
                    mode: "start",
                    workItemId,
                    ...(item.workflowId ? { workflowId: item.workflowId } : {}),
                  })
                }
              >
                Start run
              </ActionButton>
            ) : null
          }
          data-testid="work-item-page"
        >
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : loading || !item || !hash ? (
            <div className="space-y-3" data-testid="work-item-loading">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <PageTitle
                title={item.title}
                description="Context, runs and notes."
                badge={<WorkItemSourceBadge source={item.source} />}
              />

              <WorkItemContextSection
                workItemId={workItemId}
                item={item}
                hash={hash}
                onUpdated={(next, nextHash) => {
                  setLoaded((prev) =>
                    prev && prev.id === workItemId
                      ? { ...prev, item: next, hash: nextHash }
                      : prev
                  )
                }}
              />

              <WorkItemRunsSection workItemId={workItemId} />

              <WorkItemNotesSection workItemId={workItemId} />

              <PageSection title="Attachments">
                {!attachments || attachments.length === 0 ? (
                  <Empty
                    className="ring-1 ring-foreground/10"
                    data-testid="work-item-attachments-empty"
                  >
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Paperclip />
                      </EmptyMedia>
                      <EmptyTitle>No attachments</EmptyTitle>
                      <EmptyDescription>
                        Files attached to this work item will list here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ItemGroup data-testid="work-item-attachments">
                    {attachments.map((file) => (
                      <Item key={file.name} variant="outline">
                        <ItemContent>
                          <ItemTitle className={mono}>{file.name}</ItemTitle>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                )}
              </PageSection>
            </>
          )}
        </Page>
      )}
    </TrustStartGate>
  )
}

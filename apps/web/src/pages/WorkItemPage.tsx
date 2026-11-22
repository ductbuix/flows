import { useEffect, useState } from "react"
import { useParams } from "react-router"
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
import { WorkItemSourceBadge } from "@/components/WorkItemSourceBadge"
import { api } from "@/lib/api"
import { WorkItemContextSection } from "@/pages/WorkItemContextSection"
import { WorkItemNotesSection } from "@/pages/WorkItemNotesSection"
import { WorkItemRunsSection } from "@/pages/WorkItemRunsSection"
import { WorkItemStartCard } from "@/pages/WorkItemStartCard"

export function WorkItemPage() {
  const { workItemId } = useParams() as { workItemId: string }
  const [item, setItem] = useState<WorkItem | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<WorkItemAttachment[] | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    void (async () => {
      const [detailRes, filesRes] = await Promise.all([
        api.workitems[":id"].$get({ param: { id: workItemId } }),
        api.workitems[":id"].attachments.$get({ param: { id: workItemId } }),
      ])
      if (!alive) return
      if (!detailRes.ok) {
        setLoading(false)
        setError(
          detailRes.status === 404
            ? `Work item ${workItemId} was not found.`
            : "Could not load work item"
        )
        return
      }
      const detail = workItemDetailSchema.parse(await detailRes.json())
      setItem(detail.item)
      setHash(detail.hash)
      if (filesRes.ok) {
        setAttachments(
          workItemAttachmentListSchema.parse(await filesRes.json()).files
        )
      } else {
        setAttachments([])
      }
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [workItemId])

  function onStarted(runId: string) {
    toast.success(`Started run ${runId}`)
  }

  const crumbs = [
    { label: "Work items", to: "/work-items" },
    { label: item?.title ?? workItemId },
  ] as const

  return (
    <Page crumbs={[...crumbs]} data-testid="work-item-page">
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
            description="Context, runs, start a workflow and notes."
            badge={<WorkItemSourceBadge source={item.source} />}
          />

          <WorkItemContextSection
            workItemId={workItemId}
            item={item}
            hash={hash}
            onUpdated={(next, nextHash) => {
              setItem(next)
              setHash(nextHash)
            }}
          />

          <WorkItemRunsSection workItemId={workItemId} />

          <WorkItemStartCard
            workItemId={workItemId}
            initialWorkflowId={item.workflowId}
            initialInputs={item.inputs}
            onStarted={onStarted}
          />

          <WorkItemNotesSection workItemId={workItemId} />

          <PageSection title="Attachments">
            {!attachments || attachments.length === 0 ? (
              <Empty data-testid="work-item-attachments-empty">
                <EmptyHeader>
                  <EmptyTitle>No attachments</EmptyTitle>
                  <EmptyDescription>
                    Files attached to this work item will list here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup data-testid="work-item-attachments">
                {attachments.map((file) => (
                  <Item key={file.name} variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle className="font-mono">{file.name}</ItemTitle>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </PageSection>
        </>
      )}
    </Page>
  )
}

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Briefcase, FolderOpen } from "lucide-react"
import type { WorkItemSummary } from "@workspace/shared"
import { workItemSummarySchema } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import { api } from "@/lib/api"
import { useRunSummaries } from "@/lib/use-run-summaries"
import { workItemPath, workflowPath } from "@/lib/paths"
import { useWorkflows } from "@/lib/workflows-context"
import { CreateWorkflowDialog } from "@/pages/CreateWorkflowDialog"
import { CreateWorkItemDialog } from "@/pages/CreateWorkItemDialog"
import {
  collectNeedsYou,
  collectRecent,
  collectRunning,
} from "@/pages/home/home-run-filters"
import { collectHomeWorkItems } from "@/pages/home/home-work-items"
import { NeedsYouSection } from "@/pages/home/NeedsYouSection"
import { RecentRunsSection } from "@/pages/home/RecentRunsSection"
import { RunningSection } from "@/pages/home/RunningSection"
import { useExpiredSignIns } from "@/pages/home/use-expired-sign-ins"
import { WorkItemsSection } from "@/pages/home/WorkItemsSection"

export function HomePage() {
  const navigate = useNavigate()
  const { workflows, error: workflowsError, reload } = useWorkflows()
  const { runs, error: runsError } = useRunSummaries()
  const [workItems, setWorkItems] = useState<WorkItemSummary[] | null>(null)
  const [createWorkflowOpen, setCreateWorkflowOpen] = useState(false)
  const [createWorkItemOpen, setCreateWorkItemOpen] = useState(false)
  const showDashboard = Boolean(workflows && workflows.length > 0)
  const expiredSignIns = useExpiredSignIns(showDashboard)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.workitems.$get()
        if (!res.ok) throw new Error("request failed")
        const list = workItemSummarySchema.array().parse(await res.json())
        if (alive) setWorkItems(list)
      } catch {
        if (alive) setWorkItems([])
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const error = workflowsError ?? runsError
  const loading =
    !workflows ||
    workItems === null ||
    (workflows.length > 0 && !runs && !runsError)

  const homeWorkItems = useMemo(
    () => collectHomeWorkItems(runs ?? [], workItems ?? []),
    [runs, workItems]
  )

  return (
    <Page crumbs={[{ label: "Home" }]} data-testid="home-page">
      <PageTitle
        title="Home"
        description="Approvals waiting on you, expired sign-ins, work items, live runs and recent finished runs."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="w-full max-w-lg space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Empty data-testid="home-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpen />
              </EmptyMedia>
              <EmptyTitle>Create a workflow</EmptyTitle>
              <EmptyDescription>
                First launch: create a workflow to start running tasks.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                data-testid="home-create-workflow"
                onClick={() => setCreateWorkflowOpen(true)}
              >
                Create workflow
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : workItems.length === 0 &&
        (runs?.length ?? 0) === 0 &&
        expiredSignIns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Empty data-testid="home-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Briefcase />
              </EmptyMedia>
              <EmptyTitle>New work item</EmptyTitle>
              <EmptyDescription>
                You have a workflow. Create a work item to run it on.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                data-testid="home-create-work-item"
                onClick={() => setCreateWorkItemOpen(true)}
              >
                New work item
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <>
          <NeedsYouSection
            items={collectNeedsYou(runs ?? [])}
            expiredSignIns={expiredSignIns}
          />
          <RunningSection runs={collectRunning(runs ?? [])} />
          <WorkItemsSection items={homeWorkItems} />
          <RecentRunsSection runs={collectRecent(runs ?? [])} />
        </>
      )}

      <CreateWorkflowDialog
        open={createWorkflowOpen}
        onOpenChange={setCreateWorkflowOpen}
        onCreated={(id) => {
          void reload().then(() => navigate(workflowPath(id)))
        }}
      />
      <CreateWorkItemDialog
        open={createWorkItemOpen}
        onOpenChange={setCreateWorkItemOpen}
        onCreated={(id) => void navigate(workItemPath(id))}
      />
    </Page>
  )
}

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
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
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
import { WorkItemsSection } from "@/pages/home/WorkItemsSection"

export function HomePage() {
  const navigate = useNavigate()
  const { workflows, error: workflowsError, reload } = useWorkflows()
  const { runs, error: runsError } = useRunSummaries()
  const [workItems, setWorkItems] = useState<WorkItemSummary[] | null>(null)
  const [createWorkflowOpen, setCreateWorkflowOpen] = useState(false)
  const [createWorkItemOpen, setCreateWorkItemOpen] = useState(false)

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
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader crumbs={[{ label: "Home" }]} />
      <div
        className="flex flex-1 flex-col gap-6 overflow-auto p-4"
        data-testid="home-page"
      >
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
        ) : workItems.length === 0 && (runs?.length ?? 0) === 0 ? (
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
            <PageTitle
              title="Home"
              description="Approvals waiting on you, work items, live runs and recent finished runs."
            />
            <NeedsYouSection items={collectNeedsYou(runs ?? [])} />
            <RunningSection runs={collectRunning(runs ?? [])} />
            <WorkItemsSection items={homeWorkItems} />
            <RecentRunsSection runs={collectRecent(runs ?? [])} />
          </>
        )}
      </div>

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
    </div>
  )
}

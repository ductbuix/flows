import { useState } from "react"
import { useNavigate } from "react-router"
import { FolderOpen } from "lucide-react"
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
import { useRunSummaries } from "@/lib/use-run-summaries"
import { workflowPath } from "@/lib/paths"
import { useWorkflows } from "@/lib/workflows-context"
import { CreateWorkflowDialog } from "@/pages/CreateWorkflowDialog"
import {
  collectNeedsYou,
  collectRecent,
  collectRunning,
} from "@/pages/home/home-run-filters"
import { NeedsYouSection } from "@/pages/home/NeedsYouSection"
import { RecentRunsSection } from "@/pages/home/RecentRunsSection"
import { RunningSection } from "@/pages/home/RunningSection"
import { useExpiredSignIns } from "@/pages/home/use-expired-sign-ins"

export function HomePage() {
  const navigate = useNavigate()
  const { workflows, error: workflowsError, reload } = useWorkflows()
  const { runs, error: runsError } = useRunSummaries()
  const [createOpen, setCreateOpen] = useState(false)
  const showDashboard = Boolean(workflows && workflows.length > 0)
  const expiredSignIns = useExpiredSignIns(showDashboard)

  const error = workflowsError ?? runsError
  const loading = !workflows || (workflows.length > 0 && !runs && !runsError)

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
                  onClick={() => setCreateOpen(true)}
                >
                  Create workflow
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <>
            <PageTitle
              title="Home"
              description="Approvals waiting on you, expired sign-ins, live runs and recent finished runs."
            />
            <NeedsYouSection
              items={collectNeedsYou(runs ?? [])}
              expiredSignIns={expiredSignIns}
            />
            <RunningSection runs={collectRunning(runs ?? [])} />
            <RecentRunsSection runs={collectRecent(runs ?? [])} />
          </>
        )}
      </div>

      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          void reload().then(() => navigate(workflowPath(id)))
        }}
      />
    </div>
  )
}

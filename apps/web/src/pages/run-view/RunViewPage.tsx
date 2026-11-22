import { lazy, Suspense, useCallback } from "react"
import { useWorkItemTitles } from "@/hooks/use-work-item-titles"
import { runLabel } from "@/lib/labels"
import { useWorkflowLabel } from "@/lib/workflows-context"
import { useParams } from "react-router"
import type { RunDetail, TaskView } from "@workspace/shared"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Page, PageTitle, PageToolbar } from "@/components/page"
import { IdText } from "@/components/data/IdText"
import { RelativeTime } from "@/components/data/RelativeTime"
import { RunStatusBadge } from "@/components/data/RunStatusBadge"
import { formatDuration } from "@/lib/labels"
import { workflowPath } from "@/lib/paths"
import { RunControls } from "./RunControls"
import { RunEffectsTable } from "./RunEffectsTable"
import { RunLead } from "./RunLead"
import { RunLibraryPins } from "./RunLibraryPins"
import { RunSummaryCards, useRunDuration } from "./RunSummaryCards"
import { TaskList } from "./TaskList"
import { TaskDetail } from "./TaskDetail"
import { UnpublishedChanges } from "./UnpublishedChanges"
import { useSearchView } from "./useSearchView"
import { useRunSocket } from "./useRunSocket"
import { useRunFetch } from "./useRunFetch"

const TaskGraph = lazy(() =>
  import("./TaskGraph.tsx").then((m) => ({ default: m.TaskGraph }))
)

/** Failed run: first failed task; waiting: the waiting one; else running, else last. */
export function defaultTask(run: RunDetail): TaskView | undefined {
  const by = (status: TaskView["status"]) =>
    run.tasks.find((t) => t.status === status)
  return (
    by("failed") ??
    by("awaiting_approval") ??
    by("running") ??
    [...run.tasks].reverse().find((t) => t.status !== "pending") ??
    run.tasks[0]
  )
}

function RunDescription({ run }: { run: RunDetail }) {
  const workflowLabel = useWorkflowLabel(run.workflowId)
  const duration = useRunDuration(run)
  return (
    <>
      <span>{workflowLabel}</span>
      <span aria-hidden>·</span>
      <span>
        started <RelativeTime value={run.startedAt} />
      </span>
      <span aria-hidden>·</span>
      <span data-testid="run-took">took {formatDuration(duration)}</span>
      <span aria-hidden>·</span>
      <IdText id={run.id} />
    </>
  )
}

export function RunViewPage() {
  const { runId } = useParams() as { runId: string }
  const { view, taskId, tab, tabExplicit, setView, setTaskId, setTab } =
    useSearchView()
  const { run, loading, error, setRun } = useRunFetch(runId)
  const workflowId = run?.workflowId
  const workflowLabel = useWorkflowLabel(workflowId ?? "")
  const titles = useWorkItemTitles()
  const workItemTitle = run?.workItemId ? titles.get(run.workItemId) : undefined
  const thisRunLabel = runLabel({ workItemTitle })

  const crumbs = workflowId
    ? ([
        { label: "Workflows", to: "/workflows" },
        { label: workflowLabel, to: workflowPath(workflowId) },
        { label: "Runs", to: workflowPath(workflowId, "runs") },
        { label: thisRunLabel },
      ] as const)
    : ([{ label: "Workflows", to: "/workflows" }, { label: "Run" }] as const)

  const onSnapshot = useCallback(
    (next: Parameters<typeof setRun>[0]) => {
      setRun(next)
    },
    [setRun]
  )

  const { wsState } = useRunSocket(runId, run, onSnapshot)

  if (loading && !run) {
    return (
      <Page crumbs={[...crumbs]}>
        <PageTitle title="Run" description={<IdText id={runId} />} />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-100 w-full" />
      </Page>
    )
  }

  if (error || !run) {
    return (
      <Page crumbs={[...crumbs]}>
        <PageTitle title="Run" description={<IdText id={runId} />} />
        <Alert variant="destructive">
          <AlertTitle>Could not load run</AlertTitle>
          <AlertDescription>{error ?? "Unknown error"}</AlertDescription>
        </Alert>
      </Page>
    )
  }

  const auto = defaultTask(run)
  const selectedTask =
    (taskId ? run.tasks.find((t) => t.id === taskId) : undefined) ?? auto
  const effectiveTab =
    tabExplicit || taskId
      ? tab
      : auto?.status === "failed"
        ? "terminal"
        : tab
  const effects = run.effects ?? []
  const pins = run.pins ?? []

  return (
    <Page crumbs={[...crumbs]} actions={<RunControls run={run} />} fill>
      <PageTitle
        title={thisRunLabel}
        badge={
          <>
            <RunStatusBadge status={run.status} />
            {wsState === "closed" && (
              <Badge variant="secondary" data-testid="ws-reconnecting">
                Reconnecting
              </Badge>
            )}
            {!run.sandboxed && (
              <Badge
                data-testid="sandbox-badge"
                variant="destructive"
                title="Secrets protection is off; run is not sandboxed"
              >
                not sandboxed
              </Badge>
            )}
          </>
        }
        description={<RunDescription run={run} />}
      />
      <RunLead run={run} />
      <RunSummaryCards run={run} workItemTitle={workItemTitle} />
      <Tabs
        defaultValue="tasks"
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList variant="line">
          <TabsTrigger value="tasks" data-testid="run-tab-tasks">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="changes" data-testid="run-tab-changes">
            Changes
            <Badge variant="secondary">{effects.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pins" data-testid="run-tab-pins">
            Library pins
            <Badge variant="secondary">{pins.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="flex min-h-0 flex-1 flex-col gap-3">
          <PageToolbar>
            <ToggleGroup
              value={[view]}
              onValueChange={(v) => {
                const next = v[0]
                if (next === "list" || next === "graph") setView(next)
              }}
              variant="outline"
            >
              <ToggleGroupItem value="list" data-testid="run-view-list">
                List
              </ToggleGroupItem>
              <ToggleGroupItem value="graph" data-testid="run-view-graph">
                Graph
              </ToggleGroupItem>
            </ToggleGroup>
          </PageToolbar>
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-96 flex-1"
          >
            <ResizablePanel defaultSize={35} minSize={25}>
              {view === "list" ? (
                <TaskList
                  run={run}
                  selectedTaskId={selectedTask?.id}
                  onSelectTask={setTaskId}
                />
              ) : (
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <Spinner />
                    </div>
                  }
                >
                  <TaskGraph
                    run={run}
                    selectedTaskId={selectedTask?.id}
                    onSelectTask={setTaskId}
                  />
                </Suspense>
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={65} minSize={35}>
              {selectedTask ? (
                <TaskDetail
                  run={run}
                  task={selectedTask}
                  tab={effectiveTab}
                  onTabChange={setTab}
                />
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  Select a task to see output, terminal, and attempts.
                </p>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>

        <TabsContent value="changes" className="flex flex-col gap-6">
          <RunEffectsTable run={run} />
          <UnpublishedChanges run={run} />
        </TabsContent>

        <TabsContent value="pins">
          <RunLibraryPins pins={pins} />
        </TabsContent>
      </Tabs>
    </Page>
  )
}

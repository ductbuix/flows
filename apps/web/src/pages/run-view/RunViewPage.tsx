import { lazy, Suspense, useCallback } from "react"
import { useParams } from "react-router"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { AdvancedSwitch } from "@/components/AdvancedSwitch"
import { PageHeader } from "@/components/PageHeader"
import { workflowPath } from "@/lib/paths"
import { RunHeader } from "./RunHeader"
import { TaskList } from "./TaskList"
import { TaskDetail } from "./TaskDetail"
import { useSearchView } from "./useSearchView"
import { useRunSocket } from "./useRunSocket"
import { useRunFetch } from "./useRunFetch"

const TaskGraph = lazy(() =>
  import("./TaskGraph.tsx").then((m) => ({ default: m.TaskGraph }))
)

export function RunViewPage() {
  const { runId } = useParams() as { runId: string }
  const { view, taskId, setView, setTaskId } = useSearchView()
  const { run, loading, error, setRun } = useRunFetch(runId)
  const workflowId = run?.workflowId

  const crumbs = workflowId
    ? ([
        { label: "Workflows", to: "/" },
        { label: workflowId, to: workflowPath(workflowId) },
        { label: "Runs", to: workflowPath(workflowId, "runs") },
        { label: runId },
      ] as const)
    : ([{ label: "Workflows", to: "/" }, { label: runId }] as const)

  const onSnapshot = useCallback(
    (next: Parameters<typeof setRun>[0]) => {
      setRun(next)
    },
    [setRun]
  )

  const { wsState, stale } = useRunSocket(runId, run, onSnapshot)

  const selectedTask =
    run && taskId ? run.tasks.find((t) => t.id === taskId) : undefined

  const headerActions = <AdvancedSwitch />

  if (loading && !run) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader crumbs={[...crumbs]} actions={headerActions} />
        <div className="flex flex-col gap-4 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-100 w-full" />
        </div>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader crumbs={[...crumbs]} actions={headerActions} />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Could not load run</AlertTitle>
            <AlertDescription>{error ?? "Unknown error"}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader crumbs={[...crumbs]} actions={headerActions} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <RunHeader
          run={run}
          view={view}
          onViewChange={setView}
          wsState={wsState}
          stale={stale}
        />
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel defaultSize={48} minSize={28}>
            {view === "list" ? (
              <TaskList
                run={run}
                selectedTaskId={taskId}
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
                  selectedTaskId={taskId}
                  onSelectTask={setTaskId}
                />
              </Suspense>
            )}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={52} minSize={32}>
            {selectedTask ? (
              <TaskDetail run={run} task={selectedTask} />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Select a task to see logs, attempts, and output.
              </p>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

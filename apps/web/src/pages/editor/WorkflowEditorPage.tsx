import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { runSummarySchema } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { api } from "@/lib/api"
import { DeleteWorkflowDialog } from "@/pages/DeleteWorkflowDialog"
import { RenameWorkflowDialog } from "@/pages/RenameWorkflowDialog"
import { WorkflowActions } from "@/pages/WorkflowActions"
import { ConflictDialog } from "./ConflictDialog"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import { EditorGraph } from "./EditorGraph"
import { Inspector } from "./Inspector"
import { useEditorHotkeys } from "./useEditorHotkeys"
import { usePendingTaskDelete } from "./usePendingTaskDelete"
import { YamlPane } from "./YamlPane"
import { useWorkflowEditor } from "./useWorkflowEditor"

export function WorkflowEditorPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const navigate = useNavigate()
  const editor = useWorkflowEditor(workflowId)
  const { state } = editor
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [runCount, setRunCount] = useState(0)
  const { pendingDelete, requestDelete, clearPendingDelete } =
    usePendingTaskDelete(workflowId, state.workflow)

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.workflows[":workflowId"].runs.$get({
        param: { workflowId },
      })
      if (!res.ok || !alive) return
      const runs = runSummarySchema.array().parse(await res.json())
      if (alive) setRunCount(runs.length)
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  useEditorHotkeys({
    undo: editor.undo,
    redo: editor.redo,
    requestDelete,
    selectedTaskId: state.selectedTaskId,
    taskCount: state.workflow?.tasks.length ?? 0,
  })

  if (state.loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    )
  }

  if (!state.workflow && state.errors.length === 0 && !state.yaml) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Not found</AlertTitle>
        <AlertDescription>
          Workflow {workflowId} was not found.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="-m-6 flex h-[calc(100svh)] flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <h1 className="font-mono text-sm font-medium">{workflowId}</h1>
        <Button size="sm" variant="outline" onClick={editor.addCommandTask}>
          Add task
        </Button>
        <Button
          size="sm"
          data-testid="save-button"
          disabled={!state.dirty || state.errors.length > 0}
          onClick={() => void editor.save()}
        >
          Save
        </Button>
        <WorkflowActions
          workflowId={workflowId}
          onRename={() => setRenameOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
        <Link
          className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
          to={`/workflows/${workflowId}/runs`}
        >
          Runs
        </Link>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="58%" minSize="30%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="65%" minSize="30%">
              {state.workflow ? (
                <EditorGraph
                  workflow={state.workflow}
                  selectedTaskId={state.selectedTaskId}
                  onSelectTask={editor.setSelectedTaskId}
                  onConnect={editor.connectTasks}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                  Fix YAML errors to show the graph (last valid state kept when
                  possible).
                </div>
              )}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="35%" minSize="15%">
              <div className="h-full p-2">
                <YamlPane
                  value={state.yaml}
                  errors={state.errors}
                  onChange={editor.setYaml}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="42%" minSize="20%">
          {state.workflow ? (
            <Inspector
              workflowId={workflowId}
              workflow={state.workflow}
              selectedTaskId={state.selectedTaskId}
              errors={state.errors}
              onChangeGoal={editor.changeGoal}
              onChangeTask={editor.changeTask}
              onChangeInputs={editor.changeInputs}
              onChangeLimits={editor.changeLimits}
              onDeleteTask={requestDelete}
            />
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              Inspector unavailable while YAML is invalid.
            </p>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <DeleteTaskDialog
        open={Boolean(pendingDelete)}
        taskLabel={pendingDelete?.label ?? ""}
        dependents={pendingDelete?.dependents ?? []}
        mentions={pendingDelete?.mentions ?? []}
        onOpenChange={(open) => {
          if (!open) clearPendingDelete()
        }}
        onConfirm={() => {
          if (!pendingDelete) return
          editor.removeTaskPending(pendingDelete.taskId)
          clearPendingDelete()
        }}
      />
      <ConflictDialog
        open={Boolean(state.conflict)}
        diskYaml={state.conflict?.diskYaml ?? ""}
        mineYaml={state.yaml}
        showingDiff={state.showDiff}
        onReload={editor.reloadConflict}
        onKeep={editor.keepConflict}
        onShowDiff={() => editor.setShowDiff(!state.showDiff)}
      />
      <RenameWorkflowDialog
        open={renameOpen}
        workflowId={workflowId}
        onOpenChange={setRenameOpen}
        onRenamed={(newId) => navigate(`/workflows/${newId}`)}
      />
      <DeleteWorkflowDialog
        open={deleteOpen}
        workflowId={workflowId}
        runCount={runCount}
        onOpenChange={setDeleteOpen}
        onDeleted={() => navigate("/")}
      />
    </div>
  )
}

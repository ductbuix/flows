import { Link, useParams } from "react-router"
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
import { AdvancedSwitch } from "@/components/AdvancedSwitch"
import { PageHeader } from "@/components/PageHeader"
import { useAdvanced } from "@/hooks/use-advanced"
import { ConflictDialog } from "./ConflictDialog"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import { EditorGraphPane } from "./EditorGraphPane"
import { Inspector } from "./Inspector"
import { useEditorHotkeys } from "./useEditorHotkeys"
import { usePendingTaskDelete } from "./usePendingTaskDelete"
import { YamlErrorAlert } from "./YamlErrorAlert"
import { YamlPane } from "./YamlPane"
import { useWorkflowEditor } from "./useWorkflowEditor"

export function WorkflowEditorPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const editor = useWorkflowEditor(workflowId)
  const { state } = editor
  const { advanced, setAdvanced } = useAdvanced()
  const { pendingDelete, requestDelete, clearPendingDelete } =
    usePendingTaskDelete(workflowId, state.workflow)

  const crumbs = [
    { label: "Workflows", to: "/" },
    { label: workflowId },
  ] as const

  const headerActions = (
    <>
      <AdvancedSwitch />
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
      <Button
        variant="link"
        size="sm"
        render={<Link to={`/workflows/${workflowId}/runs`} />}
      >
        Runs
      </Button>
    </>
  )

  useEditorHotkeys({
    undo: editor.undo,
    redo: editor.redo,
    requestDelete,
    selectedTaskId: state.selectedTaskId,
    taskCount: state.workflow?.tasks.length ?? 0,
  })

  if (state.loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader crumbs={[...crumbs]} actions={headerActions} />
        <div className="space-y-2 p-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-120 w-full" />
        </div>
      </div>
    )
  }

  if (!state.workflow && state.errors.length === 0 && !state.yaml) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader crumbs={[...crumbs]} actions={headerActions} />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Not found</AlertTitle>
            <AlertDescription>
              Workflow {workflowId} was not found.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  const graphProps = {
    workflow: state.workflow,
    selectedTaskId: state.selectedTaskId,
    onSelectTask: editor.setSelectedTaskId,
    onConnect: editor.connectTasks,
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader crumbs={[...crumbs]} actions={headerActions} />
      {!advanced ? (
        <YamlErrorAlert
          errors={state.errors}
          onOpenAdvanced={() => setAdvanced(true)}
        />
      ) : null}

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="58%" minSize="30%">
          {advanced ? (
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize="65%" minSize="30%">
                <EditorGraphPane {...graphProps} />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="35%" minSize="15%">
                <div className="h-full p-4">
                  <YamlPane
                    value={state.yaml}
                    errors={state.errors}
                    onChange={editor.setYaml}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <EditorGraphPane {...graphProps} />
          )}
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
              onChangeAgent={editor.changeAgent}
              onDeleteTask={requestDelete}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
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
    </div>
  )
}

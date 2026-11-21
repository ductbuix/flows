import { useState } from "react"
import { useParams } from "react-router"
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
import { PageHeader } from "@/components/PageHeader"
import { WorkflowDetailTabs } from "@/pages/WorkflowDetailTabs"
import { ConflictDialog } from "./ConflictDialog"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import { EditorMainPane, type EditorPane } from "./EditorMainPane"
import { Inspector } from "./Inspector"
import { useEditorHotkeys } from "./useEditorHotkeys"
import { usePendingTaskDelete } from "./usePendingTaskDelete"
import { YamlErrorAlert } from "./YamlErrorAlert"
import { useWorkflowEditor } from "./useWorkflowEditor"

export function WorkflowEditorPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const editor = useWorkflowEditor(workflowId)
  const { state } = editor
  const [pane, setPane] = useState<EditorPane>("graph")
  const { pendingDelete, requestDelete, clearPendingDelete } =
    usePendingTaskDelete(workflowId, state.workflow)

  const crumbs = [
    { label: "Workflows", to: "/workflows" },
    { label: workflowId },
  ] as const

  const headerActions = (
    <>
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
          <WorkflowDetailTabs workflowId={workflowId} tab="editor" />
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
        <div className="space-y-4 p-4">
          <WorkflowDetailTabs workflowId={workflowId} tab="editor" />
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

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="workflow-editor"
    >
      <PageHeader crumbs={[...crumbs]} actions={headerActions} />
      <div className="shrink-0 px-4 pt-4">
        <WorkflowDetailTabs workflowId={workflowId} tab="editor" />
      </div>
      {pane === "graph" ? (
        <YamlErrorAlert
          errors={state.errors}
          onOpenYaml={() => setPane("yaml")}
        />
      ) : null}

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="58%" minSize="30%">
          <EditorMainPane
            pane={pane}
            onPaneChange={setPane}
            workflow={state.workflow}
            selectedTaskId={state.selectedTaskId}
            onSelectTask={editor.setSelectedTaskId}
            onConnect={editor.connectTasks}
            yaml={state.yaml}
            errors={state.errors}
            onChangeYaml={editor.setYaml}
          />
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

import { useState } from "react"
import { useWorkflowLabel } from "@/lib/workflows-context"
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
import { Page } from "@/components/page"
import { WorkflowStartButton } from "@/components/WorkflowStartButton"
import { WorkflowHeading } from "@/pages/WorkflowHeading"
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

  const workflowLabel = useWorkflowLabel(workflowId, state.workflow?.name)
  const crumbs = [
    { label: "Workflows", to: "/workflows" },
    { label: workflowLabel },
  ] as const

  const heading = (
    <WorkflowHeading
      workflowId={workflowId}
      name={state.workflow?.name}
      tab="editor"
      description={
        state.workflow?.goal?.trim() || "Edit the graph, tasks and YAML."
      }
    />
  )

  const headerActions = (
    <>
      <Button variant="outline" onClick={editor.addCommandTask}>
        Add task
      </Button>
      <Button
        variant="outline"
        data-testid="add-publish-task"
        onClick={editor.addPublishTask}
      >
        Add publish
      </Button>
      <WorkflowStartButton workflowId={workflowId} />
      <Button
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
      <Page crumbs={[...crumbs]} actions={headerActions}>
        {heading}
        <Skeleton className="h-120 w-full" />
      </Page>
    )
  }

  if (!state.workflow && state.errors.length === 0 && !state.yaml) {
    return (
      <Page crumbs={[...crumbs]} actions={headerActions}>
        {heading}
        <Alert variant="destructive">
          <AlertTitle>Not found</AlertTitle>
          <AlertDescription>
            Workflow {workflowId} was not found.
          </AlertDescription>
        </Alert>
      </Page>
    )
  }

  return (
    <Page
      crumbs={[...crumbs]}
      actions={headerActions}
      fill
      data-testid="workflow-editor"
    >
      {heading}
      {pane === "graph" ? (
        <YamlErrorAlert
          errors={state.errors}
          onOpenYaml={() => setPane("yaml")}
        />
      ) : null}

      <ResizablePanelGroup
        orientation="horizontal"
        data-bleed
        className="min-h-0 flex-1"
      >
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
              onChangeName={editor.changeName}
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
    </Page>
  )
}

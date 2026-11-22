import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Page } from "@/components/page"
import { WorkflowStartButton } from "@/components/WorkflowStartButton"
import { useWorkflowLabel } from "@/lib/workflows-context"
import { WorkflowHeading } from "@/pages/WorkflowHeading"
import { NodeCanvas } from "./NodeCanvas"
import { useNodeEditor } from "./useNodeEditor"

/** Editor canvas for node workflows, behind FLOWS_NODES (BL-077). */
export function NodeEditorPage({ workflowId }: { workflowId: string }) {
  const editor = useNodeEditor(workflowId)
  const workflow = editor.detail?.workflow ?? null
  const label = useWorkflowLabel(workflowId, workflow?.name)
  const crumbs = [
    { label: "Workflows", to: "/workflows" },
    { label },
  ] as const
  const heading = (
    <WorkflowHeading
      workflowId={workflowId}
      name={workflow?.name}
      tab="editor"
      description={workflow?.goal?.trim() || "Edit the nodes and edges."}
    />
  )
  const actions = <WorkflowStartButton workflowId={workflowId} />

  if (editor.loading) {
    return (
      <Page crumbs={[...crumbs]} actions={actions}>
        {heading}
        <Skeleton className="h-120 w-full" />
      </Page>
    )
  }

  const errors = editor.detail?.errors ?? []
  return (
    <Page
      crumbs={[...crumbs]}
      actions={actions}
      fill
      data-testid="workflow-editor"
    >
      {heading}
      {!editor.detail || errors.length > 0 ? (
        <Alert variant="destructive" data-testid="yaml-errors">
          <AlertTitle>
            {editor.detail ? "YAML errors" : "Not found"}
          </AlertTitle>
          <AlertDescription>
            {editor.detail ? (
              <ul className="list-inside list-disc text-sm">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={`${e.from}-${i}`}>{e.message}</li>
                ))}
              </ul>
            ) : (
              `Workflow ${workflowId} was not found.`
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {workflow ? (
        <div data-bleed className="min-h-0 flex-1 border-t">
          <NodeCanvas
            workflow={workflow}
            saved={editor.saved}
            onPositions={editor.savePositions}
          />
        </div>
      ) : null}
    </Page>
  )
}

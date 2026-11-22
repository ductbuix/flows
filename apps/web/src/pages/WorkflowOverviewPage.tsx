import { useEffect, useState } from "react"
import { useWorkflowLabel } from "@/lib/workflows-context"
import { useParams } from "react-router"
import { workflowDetailSchema, type Workflow } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page } from "@/components/page"
import { WorkflowHeading } from "@/pages/WorkflowHeading"
import { api } from "@/lib/api"
import { OverviewConnectionsSection } from "@/pages/OverviewConnectionsSection"
import { OverviewInputsSection } from "@/pages/OverviewInputsSection"
import { OverviewTasksSection } from "@/pages/OverviewTasksSection"
import { WorkflowStartButton } from "@/components/WorkflowStartButton"

export function WorkflowOverviewPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    void (async () => {
      const res = await api.workflows[":workflowId"].$get({
        param: { workflowId },
      })
      if (!alive) return
      if (!res.ok) {
        setLoading(false)
        setError(
          res.status === 404
            ? `Workflow ${workflowId} was not found.`
            : "Could not load workflow"
        )
        return
      }
      const detail = workflowDetailSchema.parse(await res.json())
      setWorkflow(detail.workflow)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  const workflowLabel = useWorkflowLabel(workflowId)
  const crumbs = [
    { label: "Workflows", to: "/workflows" },
    { label: workflowLabel },
  ] as const

  return (
    <Page
      crumbs={[...crumbs]}
      actions={workflow ? <WorkflowStartButton workflowId={workflowId} /> : null}
      data-testid="workflow-overview"
    >
      <WorkflowHeading
        workflowId={workflowId}
        tab="overview"
        description={workflow?.goal?.trim() || "Tasks, inputs and start a run."}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : workflow ? (
        <>
          <OverviewTasksSection workflow={workflow} />
          <OverviewConnectionsSection workflow={workflow} />
          <OverviewInputsSection inputs={workflow.inputs ?? []} />
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Invalid workflow</AlertTitle>
          <AlertDescription>
            Fix YAML errors in the Editor before starting a run.
          </AlertDescription>
        </Alert>
      )}
    </Page>
  )
}

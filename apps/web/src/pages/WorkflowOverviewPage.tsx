import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { workflowDetailSchema, type Workflow } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { api } from "@/lib/api"
import { runPath } from "@/lib/paths"
import { OverviewConnectionsSection } from "@/pages/OverviewConnectionsSection"
import { OverviewInputsSection } from "@/pages/OverviewInputsSection"
import { OverviewTasksSection } from "@/pages/OverviewTasksSection"
import { WorkflowDetailTabs } from "@/pages/WorkflowDetailTabs"
import { WorkflowStartCard } from "@/pages/WorkflowStartCard"

export function WorkflowOverviewPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const navigate = useNavigate()
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

  const crumbs = [
    { label: "Workflows", to: "/workflows" },
    { label: workflowId },
  ] as const

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="workflow-overview"
    >
      <PageHeader crumbs={[...crumbs]} />
      <div className="flex flex-1 flex-col gap-6 overflow-auto p-4">
        <WorkflowDetailTabs workflowId={workflowId} tab="overview" />
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
            <PageTitle
              title={workflowId}
              description={
                workflow.goal?.trim() || "Tasks, inputs and start a run."
              }
            />
            <OverviewTasksSection workflow={workflow} />
            <OverviewConnectionsSection workflow={workflow} />
            <OverviewInputsSection inputs={workflow.inputs ?? []} />
            <WorkflowStartCard
              workflowId={workflowId}
              onStarted={(runId) => {
                void navigate(runPath(runId))
              }}
            />
          </>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Invalid workflow</AlertTitle>
            <AlertDescription>
              Fix YAML errors in the Editor before starting a run.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

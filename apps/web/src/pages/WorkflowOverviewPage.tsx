import { useEffect, useState } from "react"
import { useWorkflowLabel } from "@/lib/workflows-context"
import { useParams } from "react-router"
import {
  workflowDetailSchema,
  type Workflow,
  type WorkflowInputDecl,
} from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page } from "@/components/page"
import { WorkflowHeading } from "@/pages/WorkflowHeading"
import { api } from "@/lib/api"
import { OverviewInputsSection } from "@/pages/OverviewInputsSection"
import { OverviewNodesSection } from "@/pages/OverviewNodesSection"
import { WorkflowStartButton } from "@/components/WorkflowStartButton"

type Loaded = { id: string; workflow: Workflow }

export function WorkflowOverviewPage() {
  const { workflowId } = useParams() as { workflowId: string }
  // Inputs sit on the Trigger node.
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [errorFor, setErrorFor] = useState<{
    id: string
    message: string
  } | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.workflows[":workflowId"].$get({
        param: { workflowId },
      })
      if (!alive) return
      if (!res.ok) {
        setErrorFor({
          id: workflowId,
          message:
            res.status === 404
              ? `Workflow ${workflowId} was not found.`
              : "Could not load workflow",
        })
        return
      }
      const json: unknown = await res.json()
      setErrorFor(null)
      setLoaded({
        id: workflowId,
        workflow: workflowDetailSchema.parse(json).workflow,
      })
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  const match = loaded?.id === workflowId
  const nodeWorkflow = match ? loaded.workflow : null
  const error = errorFor?.id === workflowId ? errorFor.message : null
  const loading = !match && !error

  const workflowLabel = useWorkflowLabel(workflowId)
  const nodeInputs: WorkflowInputDecl[] =
    nodeWorkflow?.nodes.flatMap((n) =>
      n.kind === "trigger" && Array.isArray(n.inputs)
        ? (n.inputs as WorkflowInputDecl[])
        : []
    ) ?? []
  const crumbs = [
    { label: "Workflows", to: "/workflows" },
    { label: workflowLabel },
  ] as const

  return (
    <Page
      crumbs={[...crumbs]}
      actions={
        nodeWorkflow ? <WorkflowStartButton workflowId={workflowId} /> : null
      }
      data-testid="workflow-overview"
    >
      <WorkflowHeading
        workflowId={workflowId}
        tab="overview"
        description={
          nodeWorkflow?.goal?.trim() || "Nodes, inputs and start a run."
        }
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
      ) : nodeWorkflow ? (
        <>
          <OverviewNodesSection workflow={nodeWorkflow} />
          <OverviewInputsSection inputs={nodeInputs} />
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

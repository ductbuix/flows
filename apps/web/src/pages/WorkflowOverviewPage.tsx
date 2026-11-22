import { useEffect, useState } from "react"
import { useWorkflowLabel } from "@/lib/workflows-context"
import { useParams } from "react-router"
import {
  nodeWorkflowDetailSchema,
  workflowDetailSchema,
  type NodeWorkflow,
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
import { OverviewConnectionsSection } from "@/pages/OverviewConnectionsSection"
import { OverviewInputsSection } from "@/pages/OverviewInputsSection"
import { OverviewNodesSection } from "@/pages/OverviewNodesSection"
import { OverviewTasksSection } from "@/pages/OverviewTasksSection"
import { WorkflowStartButton } from "@/components/WorkflowStartButton"

export function WorkflowOverviewPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  // FLOWS_NODES: the workflow is a node graph; inputs sit on its Trigger.
  const [nodeWorkflow, setNodeWorkflow] = useState<NodeWorkflow | null>(null)
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
      const json: unknown = await res.json()
      const legacy = workflowDetailSchema.safeParse(json)
      if (legacy.success) {
        setNodeWorkflow(null)
        setWorkflow(legacy.data.workflow)
      } else {
        setWorkflow(null)
        setNodeWorkflow(nodeWorkflowDetailSchema.parse(json).workflow)
      }
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

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
      actions={workflow || nodeWorkflow ? <WorkflowStartButton workflowId={workflowId} /> : null}
      data-testid="workflow-overview"
    >
      <WorkflowHeading
        workflowId={workflowId}
        tab="overview"
        description={
          (workflow?.goal ?? nodeWorkflow?.goal)?.trim() ||
          (nodeWorkflow
            ? "Nodes, inputs and start a run."
            : "Tasks, inputs and start a run.")
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

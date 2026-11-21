import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import {
  needTaskId,
  workflowDetailSchema,
  type Workflow,
  type WorkflowInputDecl,
} from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { Section } from "@/components/Section"
import { api } from "@/lib/api"
import { runPath } from "@/lib/paths"
import { WorkflowDetailTabs } from "@/pages/WorkflowDetailTabs"
import { WorkflowStartCard } from "@/pages/WorkflowStartCard"

function needsLabel(task: Workflow["tasks"][number]): string {
  const needs = task.needs ?? []
  if (needs.length === 0) return "—"
  return needs.map((n) => needTaskId(n)).join(", ")
}

function InputsSection({ inputs }: { inputs: WorkflowInputDecl[] }) {
  if (inputs.length === 0) {
    return (
      <Section title="Inputs">
        <Empty data-testid="overview-inputs-empty">
          <EmptyHeader>
            <EmptyTitle>No inputs</EmptyTitle>
            <EmptyDescription>
              This workflow has no declared start-run inputs.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Section>
    )
  }
  return (
    <Section title="Inputs">
      <Table data-testid="overview-inputs">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Required</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inputs.map((input) => (
            <TableRow key={input.name}>
              <TableCell className="font-mono">{input.name}</TableCell>
              <TableCell>{input.type}</TableCell>
              <TableCell>{input.required ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

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
            <Section title="Tasks">
              <Table data-testid="overview-tasks">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Needs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflow.tasks.map((task) => (
                    <TableRow
                      key={task.id}
                      data-testid={`overview-task-${task.id}`}
                    >
                      <TableCell>{task.name ?? task.id}</TableCell>
                      <TableCell>{task.kind}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {needsLabel(task)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
            <InputsSection inputs={workflow.inputs ?? []} />
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

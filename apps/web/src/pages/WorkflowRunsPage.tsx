import { useCallback, useEffect, useState } from "react"
import { IdText } from "@/components/data/IdText"
import { RelativeTime } from "@/components/data/RelativeTime"
import { useLabels } from "@/hooks/use-labels"
import { useWorkflowLabel } from "@/lib/workflows-context"
import { Link, useNavigate, useParams } from "react-router"
import { Play } from "lucide-react"
import type { RunSummary } from "@workspace/shared"
import { runSummarySchema } from "@workspace/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Button } from "@workspace/ui/components/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { runPath } from "@/lib/paths"
import { deleteRun } from "@/lib/run-actions"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { ActionButton } from "@/components/ActionButton"
import { Page } from "@/components/page"
import { RunStatusBadge } from "@/components/data/RunStatusBadge"
import { TrustStartGate } from "@/components/TrustStartGate"
import { RunRowMenu } from "@/pages/RunRowMenu"
import { WorkflowHeading } from "@/pages/WorkflowHeading"

const RUNS_DESCRIPTION = "Every run of this workflow, newest first."

export function WorkflowRunsPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const navigate = useNavigate()
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RunSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const workflowLabel = useWorkflowLabel(workflowId)
  const { runLabelFor } = useLabels()
  const crumbs = [
    { label: "Workflows", to: "/workflows" },
    { label: workflowLabel },
  ] as const

  const reload = useCallback(async () => {
    const res = await api.workflows[":workflowId"].runs.$get({
      param: { workflowId },
    })
    if (!res.ok) throw new Error("request failed")
    setRuns(runSummarySchema.array().parse(await res.json()))
  }, [workflowId])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        await reload()
      } catch {
        if (alive) setError("Could not load runs")
      }
    })()
    return () => {
      alive = false
    }
  }, [reload])

  async function onDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteRun(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Run deleted")
    try {
      await reload()
    } catch {
      setError("Could not reload runs")
    }
  }

  if (error) {
    return (
      <Page crumbs={[...crumbs]}>
        <WorkflowHeading
          workflowId={workflowId}
          tab="runs"
          description={RUNS_DESCRIPTION}
        />
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Page>
    )
  }

  if (!runs) {
    return (
      <Page crumbs={[...crumbs]}>
        <WorkflowHeading
          workflowId={workflowId}
          tab="runs"
          description={RUNS_DESCRIPTION}
        />
        <Skeleton className="h-40 w-full" />
      </Page>
    )
  }

  return (
    <TrustStartGate
      onStarted={(_wfId, runId) => {
        void navigate(runPath(runId))
      }}
    >
      {({ begin, pending }) => (
        <Page
          crumbs={[...crumbs]}
          actions={
            <ActionButton
              data-testid="run-start"
              pending={pending}
              onClick={() => begin({ mode: "start", workflowId })}
            >
              Start run
            </ActionButton>
          }
        >
          <WorkflowHeading
            workflowId={workflowId}
            tab="runs"
            description={RUNS_DESCRIPTION}
          />
          {runs.length === 0 ? (
            <Empty className="border" data-testid="run-list">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Play />
                </EmptyMedia>
                <EmptyTitle>No runs yet</EmptyTitle>
                <EmptyDescription>Start a run to see it here.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <ActionButton
                  data-testid="run-start"
                  pending={pending}
                  onClick={() => begin({ mode: "start", workflowId })}
                >
                  Start run
                </ActionButton>
              </EmptyContent>
            </Empty>
          ) : (
            <Table data-testid="run-list">
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id} data-testid={`run-row-${run.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="link"
                          className="h-auto p-0"
                          render={<Link to={runPath(run.id)} />}
                        >
                          {runLabelFor(run)}
                        </Button>
                        <IdText id={run.id} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge
                        status={run.status}
                        data-testid={`run-status-${run.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime value={run.startedAt} />
                    </TableCell>
                    <TableCell>
                      {run.taskCounts.done}/{run.taskCounts.total}
                    </TableCell>
                    <TableCell>
                      <RunRowMenu
                        runId={run.id}
                        live={
                          run.status === "running" || run.status === "queued"
                        }
                        onDelete={() => setDeleteTarget(run)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <ConfirmDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null)
            }}
            title={
              deleteTarget ? `Delete run ${deleteTarget.id}?` : "Delete run?"
            }
            description={
              deleteTarget ? (
                <>
                  Started {deleteTarget.startedAt}. Removes the run directory
                  runs/{deleteTarget.id}/: graph.json, every task&apos;s input/,
                  all attempt dirs with out/, SUMMARY.md, stdout.log and
                  stderr.log. The run disappears from lists. Workflow files are
                  not touched. Cannot be undone.
                </>
              ) : null
            }
            confirmLabel="Delete run"
            pending={deleting}
            onConfirm={() => void onDelete()}
          />
        </Page>
      )}
    </TrustStartGate>
  )
}

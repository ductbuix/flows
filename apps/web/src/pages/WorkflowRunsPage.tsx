import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
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
import { Badge } from "@workspace/ui/components/badge"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { deleteRun } from "@/lib/run-actions"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { ActionButton } from "@/components/ActionButton"
import { TrustStartGate } from "@/components/TrustStartGate"
import { RunRowMenu } from "@/pages/RunRowMenu"

export function WorkflowRunsPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const navigate = useNavigate()
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RunSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

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
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!runs) return <Skeleton className="h-40 w-full" />

  return (
    <TrustStartGate
      onStarted={(wfId, runId) => {
        void navigate(`/workflows/${wfId}/runs/${runId}`)
      }}
    >
      {({ begin, pending }) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="font-mono text-lg font-medium">{workflowId}</h1>
              <Link
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                to={`/workflows/${workflowId}`}
              >
                Edit workflow
              </Link>
            </div>
            <ActionButton
              data-testid="run-start"
              pending={pending}
              onClick={() => begin({ mode: "start", workflowId })}
            >
              Start run
            </ActionButton>
          </div>

          {runs.length === 0 ? (
            <Empty data-testid="run-list">
              <EmptyTitle>No runs yet</EmptyTitle>
              <EmptyDescription>Start a run to see it here.</EmptyDescription>
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
                      <Link
                        className="font-mono text-sm underline-offset-4 hover:underline"
                        to={`/workflows/${workflowId}/runs/${run.id}`}
                      >
                        {run.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{run.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.startedAt}
                    </TableCell>
                    <TableCell>
                      {run.taskCounts.finished}/{run.taskCounts.total}
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
        </div>
      )}
    </TrustStartGate>
  )
}

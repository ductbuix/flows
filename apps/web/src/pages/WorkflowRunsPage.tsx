import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
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
import { api } from "@/lib/api"

export function WorkflowRunsPage() {
  const { workflowId } = useParams() as { workflowId: string }
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.workflows[":workflowId"].runs.$get({
          param: { workflowId },
        })
        if (!res.ok) throw new Error("request failed")
        const data = runSummarySchema.array().parse(await res.json())
        if (alive) setRuns(data)
      } catch {
        if (alive) setError("Could not load runs")
      }
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!runs) {
    return <Skeleton className="h-40 w-full" />
  }

  if (runs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-lg font-medium">{workflowId}</h1>
          <Link
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            to={`/workflows/${workflowId}`}
          >
            Edit workflow
          </Link>
        </div>
        <Empty data-testid="run-list">
          <EmptyTitle>No runs yet</EmptyTitle>
          <EmptyDescription>
            Start a run from the API or e2e to see it here.
          </EmptyDescription>
          <EmptyContent />
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="font-mono text-lg font-medium">{workflowId}</h1>
        <Link
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          to={`/workflows/${workflowId}`}
        >
          Edit workflow
        </Link>
      </div>
      <Table data-testid="run-list">
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Progress</TableHead>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

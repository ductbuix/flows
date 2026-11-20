import { useEffect, useState } from "react"
import { Link } from "react-router"
import type { WorkflowSummary } from "@workspace/shared"
import { workflowSummarySchema } from "@workspace/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
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

export function HomePage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.workflows.$get()
        if (!res.ok) throw new Error("request failed")
        const data = workflowSummarySchema.array().parse(await res.json())
        if (alive) setWorkflows(data)
      } catch {
        if (alive) setError("Could not load workflows")
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!workflows) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (workflows.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No workflows</EmptyTitle>
        <EmptyDescription>
          Add a workflow under your Flows app home to get started.
        </EmptyDescription>
        <EmptyContent />
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">Workflows</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Goal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map((wf) => (
            <TableRow key={wf.id}>
              <TableCell>
                <Link
                  className="font-mono text-sm underline-offset-4 hover:underline"
                  to={`/workflows/${wf.id}`}
                >
                  {wf.id}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {wf.goal ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

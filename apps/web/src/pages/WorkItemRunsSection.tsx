import { Link, useNavigate } from "react-router"
import { Play } from "lucide-react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { RunStatusBadge } from "@/components/RunStatusBadge"
import { PageSection } from "@/components/page"
import { useRunsList } from "@/hooks/use-runs-list"
import { runPath } from "@/lib/paths"

type Props = {
  workItemId: string
}

/** Runs for one work item, kept live via runs_changed. */
export function WorkItemRunsSection({ workItemId }: Props) {
  const navigate = useNavigate()
  const { runs, error } = useRunsList({ workItemId })

  return (
    <PageSection title="Runs">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !runs ? (
        <div className="space-y-3" data-testid="work-item-runs-loading">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : runs.length === 0 ? (
        <Empty data-testid="work-item-runs-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Play />
            </EmptyMedia>
            <EmptyTitle>No runs yet</EmptyTitle>
            <EmptyDescription>
              Start a workflow below to see runs here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table data-testid="work-item-runs-table">
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow
                key={run.id}
                className="cursor-pointer"
                data-testid={`work-item-run-${run.id}`}
                onClick={() => void navigate(runPath(run.id))}
              >
                <TableCell>
                  <Link
                    to={runPath(run.id)}
                    className="font-mono text-sm hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {run.id}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {run.workflowName}
                </TableCell>
                <TableCell>
                  <RunStatusBadge
                    status={run.status}
                    needsYou={run.needsYou.length > 0}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {run.startedAt}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageSection>
  )
}

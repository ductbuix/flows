import { Link, useNavigate } from "react-router"
import { IdText } from "@/components/data/IdText"
import { RelativeTime } from "@/components/data/RelativeTime"
import { useLabels } from "@/hooks/use-labels"
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
import { RunStatusBadge } from "@/components/data/RunStatusBadge"
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
  const { workflowLabelFor } = useLabels()

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
        <Empty
          className="ring-1 ring-foreground/10"
          data-testid="work-item-runs-empty"
        >
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
                  <div className="flex items-center gap-2">
                    <Link
                      to={runPath(run.id)}
                      className="text-sm font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {workflowLabelFor(run.workflowId)}
                    </Link>
                    <IdText id={run.id} />
                  </div>
                </TableCell>
                <TableCell>
                  <RunStatusBadge
                    status={run.status}
                    needsYou={run.needsYou.length > 0}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <RelativeTime value={run.startedAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageSection>
  )
}

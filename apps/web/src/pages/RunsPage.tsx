import { Fragment, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { Play } from "lucide-react"
import type { RunStatus } from "@workspace/shared"
import { runStatusSchema } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { RunStatusBadge } from "@/components/RunStatusBadge"
import { useRunsList } from "@/hooks/use-runs-list"
import { groupRunsByItem } from "@/lib/group-runs-by-item"
import { runPath } from "@/lib/paths"
import { useWorkflows } from "@/lib/workflows-context"

const STATUS_ALL = "all"
const WORKFLOW_ALL = "all"
const STATUSES = runStatusSchema.options

export function RunsPage() {
  const navigate = useNavigate()
  const { workflows } = useWorkflows()
  const [status, setStatus] = useState<string>(STATUS_ALL)
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOW_ALL)

  const filters = useMemo(
    () => ({
      status:
        status !== STATUS_ALL && runStatusSchema.safeParse(status).success
          ? (status as RunStatus)
          : undefined,
      workflowId: workflowId !== WORKFLOW_ALL ? workflowId : undefined,
    }),
    [status, workflowId]
  )

  const { runs, error } = useRunsList(filters)
  const groups = useMemo(() => (runs ? groupRunsByItem(runs) : null), [runs])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader crumbs={[{ label: "Runs" }]} />
      <div
        className="flex flex-1 flex-col gap-6 overflow-auto p-6"
        data-testid="runs-page"
      >
        <PageTitle
          title="Runs"
          description="All runs across workflows, grouped by item key."
        />
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !runs ? (
          <div className="space-y-3" data-testid="runs-loading">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger
                  className="w-44"
                  data-testid="runs-filter-status"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={workflowId}
                onValueChange={(v) => v && setWorkflowId(v)}
              >
                <SelectTrigger
                  className="w-52"
                  data-testid="runs-filter-workflow"
                >
                  <SelectValue placeholder="Workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WORKFLOW_ALL}>All workflows</SelectItem>
                  {(workflows ?? []).map((wf) => (
                    <SelectItem key={wf.id} value={wf.id}>
                      {wf.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {runs.length === 0 ? (
              <Empty data-testid="runs-empty">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Play />
                  </EmptyMedia>
                  <EmptyTitle>No runs</EmptyTitle>
                  <EmptyDescription>
                    Start a run from a workflow, or clear the filters.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table data-testid="runs-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups!.map((group) => (
                    <Fragment key={group.key}>
                      <TableRow data-testid={`runs-group-${group.key}`}>
                        <TableCell
                          colSpan={5}
                          className="bg-muted/40 font-medium"
                        >
                          {group.key}
                        </TableCell>
                      </TableRow>
                      {group.runs.map((run) => (
                        <TableRow
                          key={run.id}
                          className="cursor-pointer"
                          data-testid={`runs-row-${run.id}`}
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
                              data-testid={`runs-status-${run.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {run.startedAt}
                          </TableCell>
                          <TableCell>
                            {run.taskCounts.done}/{run.taskCounts.total}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>
    </div>
  )
}

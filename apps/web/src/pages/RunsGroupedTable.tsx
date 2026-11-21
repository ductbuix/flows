import { Fragment } from "react"
import { Link, useNavigate } from "react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { RunStatusBadge } from "@/components/RunStatusBadge"
import type { RunItemGroup } from "@/lib/group-runs-by-item"
import { runPath } from "@/lib/paths"

type Props = {
  groups: RunItemGroup[]
}

export function RunsGroupedTable({ groups }: Props) {
  const navigate = useNavigate()
  return (
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
        {groups.map((group) => (
          <Fragment key={group.key}>
            <TableRow data-testid={`runs-group-${group.key}`}>
              <TableCell colSpan={5} className="bg-muted/40 font-medium">
                {group.label}
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
  )
}

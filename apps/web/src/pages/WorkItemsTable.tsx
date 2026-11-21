import { Link } from "react-router"
import type { RunSummary, WorkItemSummary } from "@workspace/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { RunStatusBadge } from "@/components/RunStatusBadge"
import { WorkItemSourceBadge } from "@/components/WorkItemSourceBadge"
import { workItemPath } from "@/lib/paths"

type Props = {
  items: WorkItemSummary[]
  lastRuns: Map<string, RunSummary>
  onOpen: (id: string) => void
}

export function WorkItemsTable({ items, lastRuns, onOpen }: Props) {
  return (
    <Table data-testid="work-items-table">
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Workflow</TableHead>
          <TableHead>Last run</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const last = lastRuns.get(item.id)
          return (
            <TableRow
              key={item.id}
              className="cursor-pointer"
              data-testid={`work-items-row-${item.id}`}
              onClick={() => onOpen(item.id)}
            >
              <TableCell>
                <Link
                  to={workItemPath(item.id)}
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.title}
                </Link>
              </TableCell>
              <TableCell>
                <WorkItemSourceBadge
                  source={item.source}
                  data-testid={`work-items-source-${item.id}`}
                />
              </TableCell>
              <TableCell className="font-mono text-sm">
                {item.workflowId ?? "—"}
              </TableCell>
              <TableCell>
                {last ? (
                  <RunStatusBadge
                    status={last.status}
                    needsYou={last.needsYou.length > 0}
                    data-testid={`work-items-last-status-${item.id}`}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

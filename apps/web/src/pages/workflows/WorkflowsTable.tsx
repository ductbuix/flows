import { cn } from "@workspace/ui/lib/utils"
import type { WorkflowSummary } from "@workspace/contracts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { mono } from "@/components/data/mono"
import { workflowLabel } from "@/lib/labels"
import { WorkflowRowMenu } from "./WorkflowRowMenu"

type Props = {
  shown: readonly WorkflowSummary[]
  onOpen: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

export function WorkflowsTable({ shown, onOpen, onRename, onDelete }: Props) {
  return (
    <div className="shrink-0">
      <Table data-testid="workflows-table">
        <TableHeader>
          <TableRow>
            <TableHead>Solves</TableHead>
            <TableHead className="text-right">Tasks</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((w) => (
            <TableRow
              key={w.id}
              className="cursor-pointer"
              onClick={() => onOpen(w.id)}
              data-testid={`workflow-${w.id}`}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{workflowLabel(w)}</span>
                  {w.goal && (
                    <span className="max-w-md truncate text-xs text-muted-foreground">
                      {w.goal}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className={cn("text-right tabular-nums", mono)}>
                {w.taskCount}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <WorkflowRowMenu
                  name={workflowLabel(w)}
                  onRename={() => onRename(w.id)}
                  onDelete={() => onDelete(w.id)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

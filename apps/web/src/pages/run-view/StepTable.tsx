import type { RunDetail } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { mono } from "@/components/data/mono"
import { formatDuration } from "@/lib/labels"
import { viewOf } from "@/nodes"
import { branchLabel } from "@/nodes/NodeFrame"

type Props = {
  run: RunDetail
  selectedTaskId?: string
  onSelectTask: (nodeId: string) => void
}

/** Step table of a node run: one row per pass of each node (BL-087). */
export function StepTable({ run, selectedTaskId, onSelectTask }: Props) {
  const names = new Map(
    run.graph.tasks.map((t) => [t.id, t.name ?? t.id] as const)
  )
  return (
    <ScrollArea className="h-full">
      <Table data-testid="step-table">
        <TableHeader>
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead>Pass</TableHead>
            <TableHead>Attempt</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Verdict</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(run.steps ?? []).map((step) => {
            const Icon = viewOf(step.kind)?.icon
            const key = `${step.nodeId}-${step.pass}`
            const end = step.endedAt ? Date.parse(step.endedAt) : Date.now()
            return (
              <TableRow
                key={key}
                data-testid={`step-row-${key}`}
                className={cn(
                  "cursor-pointer",
                  selectedTaskId === step.nodeId && "bg-muted/50"
                )}
                onClick={() => onSelectTask(step.nodeId)}
              >
                <TableCell>
                  <span className="flex items-center gap-2">
                    {Icon ? (
                      <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-label={step.kind}
                      />
                    ) : null}
                    <span className={`${mono} text-sm`}>
                      {names.get(step.nodeId) ?? step.nodeId}
                    </span>
                  </span>
                </TableCell>
                <TableCell>{step.pass}</TableCell>
                <TableCell>{step.attempts}</TableCell>
                <TableCell>
                  <Badge
                    variant={step.status === "failed" ? "destructive" : "outline"}
                    data-testid={`step-state-${key}`}
                  >
                    {step.status}
                  </Badge>
                </TableCell>
                <TableCell data-testid={`step-verdict-${key}`}>
                  {step.branch
                    ? branchLabel(step.branch)
                    : step.decision
                      ? branchLabel(step.decision)
                      : step.kind === "judge" && step.failReason
                      ? step.failReason
                      : "-"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {step.startedAt
                    ? formatDuration(end - Date.parse(step.startedAt))
                    : "-"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

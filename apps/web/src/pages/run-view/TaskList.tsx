import type { RunDetail, TaskView } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import { mono } from "@/components/data/mono"

type Props = {
  run: RunDetail
  selectedTaskId?: string
  onSelectTask: (taskId: string) => void
}

function spawnedIndent(task: TaskView): string {
  return task.spawned ? "pl-6" : ""
}

export function TaskList({ run, selectedTaskId, onSelectTask }: Props) {
  const labels = new Map(
    run.graph.tasks.map((t) => [t.id, t.name ?? t.id] as const)
  )
  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Attempts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {run.tasks.map((task) => (
            <TableRow
              key={task.id}
              data-testid={`task-row-${task.id}`}
              className={cn(
                "cursor-pointer",
                selectedTaskId === task.id && "bg-muted/50"
              )}
              onClick={() => onSelectTask(task.id)}
            >
              <TableCell className={spawnedIndent(task)}>
                <span className={`${mono} text-sm`}>
                  {labels.get(task.id) ?? task.id}
                </span>
                {task.spawned && (
                  <Badge
                    className="ml-2"
                    variant="outline"
                    data-testid={`task-spawned-${task.id}`}
                  >
                    spawned
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" data-testid={`task-state-${task.id}`}>
                  {task.status}
                </Badge>
              </TableCell>
              <TableCell>{task.attempts.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

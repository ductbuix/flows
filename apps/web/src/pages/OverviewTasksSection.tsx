import type { Workflow } from "@workspace/shared"
import { needTaskId } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Section } from "@/components/Section"
import { taskConnectionIds } from "@/pages/overview-connections"

function needsLabel(task: Workflow["tasks"][number]): string {
  const needs = task.needs ?? []
  if (needs.length === 0) return "—"
  return needs.map((n) => needTaskId(n)).join(", ")
}

type Props = { workflow: Workflow }

export function OverviewTasksSection({ workflow }: Props) {
  return (
    <Section title="Tasks">
      <Table data-testid="overview-tasks">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Connections</TableHead>
            <TableHead>Needs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflow.tasks.map((task) => {
            const connections = taskConnectionIds(task)
            return (
              <TableRow key={task.id} data-testid={`overview-task-${task.id}`}>
                <TableCell>{task.name ?? task.id}</TableCell>
                <TableCell>{task.kind}</TableCell>
                <TableCell>
                  {connections.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {connections.map((id) => (
                        <Badge key={id} variant="outline">
                          {id}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {needsLabel(task)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Section>
  )
}

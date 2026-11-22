import type { TaskView } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"

export function TaskStatusBadge({ status }: { status: TaskView["status"] }) {
  return (
    <Badge
      variant={status === "failed" ? "destructive" : "outline"}
      data-testid="task-detail-status"
    >
      {status}
    </Badge>
  )
}

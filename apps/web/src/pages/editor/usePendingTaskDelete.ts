import { useCallback, useState } from "react"
import {
  dependentsOf,
  taskLabel,
  type MentionHit,
  type TaskLabel,
  type Workflow,
} from "@workspace/shared"
import { loadTaskMentions } from "./load-task-mentions"

export type PendingDelete = {
  taskId: string
  label: string
  dependents: TaskLabel[]
  mentions: MentionHit[]
}

export function usePendingTaskDelete(
  workflowId: string,
  workflow: Workflow | null
) {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  const requestDelete = useCallback(
    (taskId: string) => {
      if (!workflow || workflow.tasks.length <= 1) return
      const task = workflow.tasks.find((t) => t.id === taskId)
      if (!task) return
      setPendingDelete({
        taskId,
        label: taskLabel(task),
        dependents: dependentsOf(workflow, taskId),
        mentions: [],
      })
      void loadTaskMentions(workflowId, workflow, taskId).then((mentions) => {
        setPendingDelete((p) =>
          p && p.taskId === taskId ? { ...p, mentions } : p
        )
      })
    },
    [workflow, workflowId]
  )

  return {
    pendingDelete,
    requestDelete,
    clearPendingDelete: () => setPendingDelete(null),
  }
}

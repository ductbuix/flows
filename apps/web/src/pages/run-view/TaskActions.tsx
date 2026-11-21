import type { RunDetail, TaskView } from "@workspace/shared"
import { toast } from "sonner"
import { useState } from "react"
import { ActionButton } from "@/components/ActionButton"
import { retryTask } from "@/lib/run-actions"

type Props = {
  run: RunDetail
  task: TaskView
}

function canRetry(task: TaskView): boolean {
  if (task.status === "failed") return true
  const last = task.attempts.at(-1)
  return Boolean(last?.interrupted)
}

/** Per-task actions in the task Card (approve lives in RunLead). */
export function TaskActions({ run, task }: Props) {
  const [pending, setPending] = useState(false)
  const awaiting = task.status === "awaiting_approval"
  const retryOk = canRetry(task)

  async function onRetry() {
    setPending(true)
    const result = await retryTask(run.id, task.id)
    setPending(false)
    if (!result.ok) toast.error(result.error)
  }

  if (awaiting) return null

  return (
    <ActionButton
      size="sm"
      data-testid="task-retry"
      pending={pending}
      disabled={!retryOk}
      disabledReason="Task must be failed or its last attempt interrupted"
      onClick={() => void onRetry()}
    >
      Retry
    </ActionButton>
  )
}

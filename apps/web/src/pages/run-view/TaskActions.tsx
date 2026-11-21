import { useState } from "react"
import type { RunDetail, TaskView } from "@workspace/shared"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@workspace/ui/components/button-group"
import { toast } from "sonner"
import { ActionButton } from "@/components/ActionButton"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { approveTask, rejectTask, retryTask } from "@/lib/run-actions"

type Props = {
  run: RunDetail
  task: TaskView
}

function canRetry(task: TaskView): boolean {
  if (task.status === "failed") return true
  const last = task.attempts.at(-1)
  return Boolean(last?.interrupted)
}

export function TaskActions({ run, task }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const awaiting = task.status === "awaiting_approval"
  const retryOk = canRetry(task)

  async function onRetry() {
    setPending("retry")
    const result = await retryTask(run.id, task.id)
    setPending(null)
    if (!result.ok) toast.error(result.error)
  }

  async function onApprove() {
    setPending("approve")
    const result = await approveTask(run.id, task.id)
    setPending(null)
    if (!result.ok) toast.error(result.error)
  }

  async function onReject() {
    setPending("reject")
    const result = await rejectTask(run.id, task.id)
    setPending(null)
    setRejectOpen(false)
    if (!result.ok) toast.error(result.error)
  }

  return (
    <>
      <ButtonGroup>
        <ActionButton
          size="sm"
          data-testid="task-retry"
          pending={pending === "retry"}
          disabled={!retryOk}
          disabledReason="Task must be failed or its last attempt interrupted"
          onClick={() => void onRetry()}
        >
          Retry
        </ActionButton>
        <ButtonGroupSeparator />
        <ActionButton
          size="sm"
          data-testid="task-approve"
          pending={pending === "approve"}
          disabled={!awaiting}
          disabledReason="Task is not awaiting approval"
          onClick={() => void onApprove()}
        >
          Approve
        </ActionButton>
        <ButtonGroupSeparator />
        <ActionButton
          size="sm"
          variant="destructive"
          data-testid="task-reject"
          pending={pending === "reject"}
          disabled={!awaiting}
          disabledReason="Task is not awaiting approval"
          onClick={() => setRejectOpen(true)}
        >
          Reject
        </ActionButton>
      </ButtonGroup>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this task?"
        description="It ends as failed, and the run fails unless the task has continueOnError."
        confirmLabel="Reject"
        cancelLabel="Keep waiting"
        pending={pending === "reject"}
        onConfirm={() => void onReject()}
      />
    </>
  )
}

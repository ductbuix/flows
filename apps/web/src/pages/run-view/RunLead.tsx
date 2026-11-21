import { Link } from "react-router"
import type { RunDetail, TaskView } from "@workspace/shared"
import { ShieldCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Confirmation } from "@/components/ai-elements/confirmation"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { approveTask, rejectTask } from "@/lib/run-actions"
import { runTaskPath } from "@/lib/paths"

type Props = {
  run: RunDetail
}

function firstFailedTask(run: RunDetail): TaskView | undefined {
  return run.tasks.find((t) => t.status === "failed")
}

/** Waiting Confirmation or failure Alert at the top of the run view (DES-025). */
export function RunLead({ run }: Props) {
  const waiting = run.tasks.filter((t) => t.status === "awaiting_approval")
  const [rejectTaskId, setRejectTaskId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  async function onApprove(taskId: string) {
    setPending(`approve-${taskId}`)
    const result = await approveTask(run.id, taskId)
    setPending(null)
    if (!result.ok) toast.error(result.error)
  }

  async function onReject(taskId: string) {
    setPending(`reject-${taskId}`)
    const result = await rejectTask(run.id, taskId)
    setPending(null)
    setRejectTaskId(null)
    if (!result.ok) toast.error(result.error)
  }

  if (waiting.length > 0) {
    return (
      <div className="flex flex-col gap-3" data-testid="run-waiting">
        {waiting.map((t) => (
          <Confirmation
            key={t.id}
            data-testid="task-confirmation"
            icon={<ShieldCheck />}
            title={`Approve ${t.id}?`}
            description="The task runs after approval. Deny ends it as failed."
            approveLabel="Approve"
            denyLabel="Reject"
            approveTestId="task-approve"
            denyTestId="task-reject"
            pending={
              pending === `approve-${t.id}` || pending === `reject-${t.id}`
            }
            onApprove={() => void onApprove(t.id)}
            onDeny={() => setRejectTaskId(t.id)}
          />
        ))}
        <ConfirmDialog
          open={rejectTaskId !== null}
          onOpenChange={(open) => {
            if (!open) setRejectTaskId(null)
          }}
          title="Reject this task?"
          description="It ends as failed, and the run fails unless the task has continueOnError."
          confirmLabel="Reject"
          cancelLabel="Keep waiting"
          pending={
            rejectTaskId !== null && pending === `reject-${rejectTaskId}`
          }
          onConfirm={() => {
            if (rejectTaskId) void onReject(rejectTaskId)
          }}
        />
      </div>
    )
  }

  if (run.status === "failed") {
    const failed = firstFailedTask(run)
    if (!failed) return null
    const terminalHref = runTaskPath(run.id, failed.id, "terminal")
    return (
      <Alert variant="destructive" data-testid="run-failed-alert">
        <AlertTitle>Run failed</AlertTitle>
        <AlertDescription>
          Task{" "}
          <span className="font-mono" data-testid="run-failed-task">
            {failed.id}
          </span>{" "}
          failed.{" "}
          <Link
            to={terminalHref}
            className="underline underline-offset-2"
            data-testid="run-failed-terminal-link"
          >
            Open its Terminal
          </Link>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

import { useState } from "react"
import { useLabels } from "@/hooks/use-labels"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Confirmation } from "@/components/ai-elements/confirmation"
import { PageSection } from "@/components/page"
import { approveTask, rejectTask } from "@/lib/run-actions"
import type { NeedsYouItem } from "./home-run-filters"
import { ExpiredSignIns, type ExpiredSignIn } from "./ExpiredSignIns"

type Props = {
  items: NeedsYouItem[]
  expiredSignIns?: ExpiredSignIn[]
}

export function NeedsYouSection({ items, expiredSignIns = [] }: Props) {
  const { workflowLabelFor, runLabelFor } = useLabels()
  const [rejectTarget, setRejectTarget] = useState<NeedsYouItem | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  if (items.length === 0 && expiredSignIns.length === 0) return null

  async function onApprove(item: NeedsYouItem) {
    const key = `${item.run.id}:${item.taskId}:approve`
    setPendingKey(key)
    const result = await approveTask(item.run.id, item.taskId)
    setPendingKey(null)
    if (!result.ok) toast.error(result.error)
  }

  async function onReject() {
    if (!rejectTarget) return
    const key = `${rejectTarget.run.id}:${rejectTarget.taskId}:reject`
    setPendingKey(key)
    const result = await rejectTask(rejectTarget.run.id, rejectTarget.taskId)
    setPendingKey(null)
    setRejectTarget(null)
    if (!result.ok) toast.error(result.error)
  }

  return (
    <PageSection title="Needs you">
      <div className="flex flex-col gap-3" data-testid="home-needs-you">
        <ExpiredSignIns items={expiredSignIns} />
        {items.map((item) => {
          const key = `${item.run.id}:${item.taskId}`
          const pending =
            pendingKey === `${key}:approve` || pendingKey === `${key}:reject`
          const publish = Boolean(item.connectionId)
          return (
            <Confirmation
              key={key}
              data-testid={`home-needs-you-${item.run.id}-${item.taskId}`}
              icon={<ShieldCheck />}
              title={
                publish
                  ? `${workflowLabelFor(item.run.workflowId)} · publish ${item.taskId}`
                  : `${workflowLabelFor(item.run.workflowId)} · ${item.taskId}`
              }
              description={
                publish
                  ? `Connection ${item.connectionId} · ${runLabelFor(item.run)}`
                  : item.question !== undefined
                    ? `${item.question} · ${runLabelFor(item.run)}`
                    : runLabelFor(item.run)
              }
              approveLabel={publish ? "Publish" : "Approve"}
              denyLabel={publish ? "Discard" : "Reject"}
              approveTestId={`home-approve-${item.run.id}-${item.taskId}`}
              denyTestId={`home-reject-${item.run.id}-${item.taskId}`}
              pending={pending}
              onApprove={() => void onApprove(item)}
              onDeny={() => setRejectTarget(item)}
            />
          )
        })}
      </div>

      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null)
        }}
        title={
          rejectTarget?.question !== undefined
            ? "Reject and stop this run?"
            : "Reject this task?"
        }
        description={
          rejectTarget?.question !== undefined
            ? "The run ends as cancelled. This cannot be undone."
            : "It ends as failed, and the run fails unless the task has continueOnError."
        }
        confirmLabel="Reject"
        cancelLabel="Keep waiting"
        pending={
          rejectTarget !== null &&
          pendingKey === `${rejectTarget.run.id}:${rejectTarget.taskId}:reject`
        }
        onConfirm={() => void onReject()}
      />
    </PageSection>
  )
}

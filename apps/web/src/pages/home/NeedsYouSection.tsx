import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Confirmation } from "@/components/ai-elements/confirmation"
import { Section } from "@/components/Section"
import { approveTask, rejectTask } from "@/lib/run-actions"
import type { NeedsYouItem } from "./home-run-filters"
import { ExpiredSignIns, type ExpiredSignIn } from "./ExpiredSignIns"

type Props = {
  items: NeedsYouItem[]
  expiredSignIns?: ExpiredSignIn[]
}

export function NeedsYouSection({ items, expiredSignIns = [] }: Props) {
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
    <Section title="Needs you">
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
                  ? `${item.run.workflowName} · publish ${item.taskId}`
                  : `${item.run.workflowName} · ${item.taskId}`
              }
              description={
                publish
                  ? `Connection ${item.connectionId} · Run ${item.run.id}`
                  : `Run ${item.run.id}`
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
        title="Reject this task?"
        description="It ends as failed, and the run fails unless the task has continueOnError."
        confirmLabel="Reject"
        cancelLabel="Keep waiting"
        pending={
          rejectTarget !== null &&
          pendingKey === `${rejectTarget.run.id}:${rejectTarget.taskId}:reject`
        }
        onConfirm={() => void onReject()}
      />
    </Section>
  )
}

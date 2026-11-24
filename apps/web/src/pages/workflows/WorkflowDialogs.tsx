import type { FlowsClient } from "@workspace/sdk"
import type { WorkflowSummary } from "@workspace/contracts"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { NewWorkflowDialog } from "@/pages/mock/NewWorkflowDialog"
import {
  createWorkflow,
  deleteWorkflow,
  uniqueWorkflowId,
  updateWorkflowMeta,
} from "./workflow-actions"

type Props = {
  client: FlowsClient
  items: WorkflowSummary[]
  creating: boolean
  renamingId: string | null
  deletingId: string | null
  onCreating: (v: boolean) => void
  onRenamingId: (id: string | null) => void
  onDeletingId: (id: string | null) => void
  onCreated: (id: string) => void
  onConflict: () => void
  onError: (message: string) => void
  onClearErrors: () => void
}

export function WorkflowDialogs({
  client,
  items,
  creating,
  renamingId,
  deletingId,
  onCreating,
  onRenamingId,
  onDeletingId,
  onCreated,
  onConflict,
  onError,
  onClearErrors,
}: Props) {
  const renaming = items.find((w) => w.id === renamingId) ?? null
  const deleting = items.find((w) => w.id === deletingId) ?? null

  return (
    <>
      <NewWorkflowDialog
        open={creating}
        onOpenChange={onCreating}
        onCreate={(name, solves) => {
          onClearErrors()
          const id = uniqueWorkflowId(name, items)
          const goal = solves.trim() || name
          void createWorkflow(client, id, name, goal).then((result) => {
            if (result === "ok") onCreated(id)
            else if (result === "conflict") onConflict()
            else onError(result)
          })
        }}
      />
      {renaming ? (
        <NewWorkflowDialog
          key={renaming.id}
          open
          initial={{
            name: renaming.name ?? renaming.id,
            solves: renaming.goal ?? "",
          }}
          onOpenChange={(o) => !o && onRenamingId(null)}
          onCreate={(name, solves) => {
            onClearErrors()
            const goal = solves.trim() || name
            void updateWorkflowMeta(client, renaming.id, name, goal).then(
              (result) => {
                if (result === "conflict") onConflict()
                else if (result !== "ok") onError(result)
                onRenamingId(null)
              }
            )
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && onDeletingId(null)}
        title="Delete this workflow?"
        description="Its workflow.yaml and folders are removed. Cards stay as they are."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleting) return
          onClearErrors()
          void deleteWorkflow(client, deleting.id).then((result) => {
            if (result !== "ok") onError(result)
            onDeletingId(null)
          })
        }}
      />
    </>
  )
}

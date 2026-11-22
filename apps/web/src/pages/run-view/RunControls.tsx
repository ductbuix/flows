import { useState } from "react"
import { useNavigate } from "react-router"
import type { RunDetail } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { ActionButton } from "@/components/ActionButton"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { TrustStartGate } from "@/components/TrustStartGate"
import { runPath, workflowPath } from "@/lib/paths"
import { cancelRun, deleteRun } from "@/lib/run-actions"

type Props = {
  run: RunDetail
}

export function RunControls({ run }: Props) {
  const navigate = useNavigate()
  const live = run.status === "running" || run.status === "queued"
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  async function onCancel() {
    setPending("cancel")
    const result = await cancelRun(run.id)
    setPending(null)
    setCancelOpen(false)
    if (!result.ok) toast.error(result.error)
  }

  async function onDelete() {
    setPending("delete")
    const result = await deleteRun(run.id)
    setPending(null)
    setDeleteOpen(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Run deleted")
    void navigate(workflowPath(run.workflowId, "runs"))
  }

  return (
    <TrustStartGate
      onStarted={(_wfId, runId) => {
        void navigate(runPath(runId))
      }}
    >
      {({ begin, pending: trustPending }) => (
        <>
          <div className="flex items-center gap-2">
            {live ? (
              <ActionButton
                variant="outline"
                data-testid="run-cancel"
                pending={pending === "cancel"}
                onClick={() => setCancelOpen(true)}
              >
                Cancel
              </ActionButton>
            ) : (
              <ActionButton
                data-testid="run-rerun"
                pending={pending === "rerun" || trustPending}
                tooltip="Starts a new run from the current workflow.yaml (may differ from this run's frozen graph)"
                onClick={() =>
                  begin({
                    mode: "rerun",
                    runId: run.id,
                    workflowId: run.workflowId,
                  })
                }
              >
                Rerun
              </ActionButton>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="More"
                    data-testid={`run-menu-${run.id}`}
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  data-testid="run-delete"
                  disabled={live}
                  onClick={() => {
                    if (!live) setDeleteOpen(true)
                  }}
                >
                  {live ? "Cancel the run before deleting it" : "Delete run"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ConfirmDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title={
              run.status === "queued"
                ? "Cancel this queued run?"
                : "Cancel this run?"
            }
            description={
              run.status === "queued"
                ? "It will not start."
                : "Running tasks are stopped. Finished task outputs are kept."
            }
            confirmLabel="Cancel run"
            cancelLabel={
              run.status === "queued" ? "Keep queued" : "Keep running"
            }
            pending={pending === "cancel"}
            onConfirm={() => void onCancel()}
          />

          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={`Delete run ${run.id}?`}
            description={
              <>
                Started {run.startedAt}. Removes the run directory runs/
                {run.id}/: graph.json, every task&apos;s input/, all attempt
                dirs with out/, SUMMARY.md, stdout.log and stderr.log. The run
                disappears from lists. Workflow files are not touched. Cannot be
                undone.
              </>
            }
            confirmLabel="Delete run"
            pending={pending === "delete"}
            onConfirm={() => void onDelete()}
          />
        </>
      )}
    </TrustStartGate>
  )
}

import { useState } from "react"
import { useNavigate } from "react-router"
import type { RunDetail } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@workspace/ui/components/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { ActionButton } from "@/components/ActionButton"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { approveTask, cancelRun, deleteRun, rerunRun } from "@/lib/run-actions"

type Props = {
  run: RunDetail
  workflowId: string
}

export function RunControls({ run, workflowId }: Props) {
  const navigate = useNavigate()
  const live = run.status === "running"
  const waiting = run.tasks.filter((t) => t.status === "awaiting_approval")
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

  async function onRerun() {
    setPending("rerun")
    const result = await rerunRun(run.id)
    setPending(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    void navigate(`/workflows/${workflowId}/runs/${result.data.runId}`)
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
    void navigate(`/workflows/${workflowId}/runs`)
  }

  async function onApprove(taskId: string) {
    setPending(`approve-${taskId}`)
    const result = await approveTask(run.id, taskId)
    setPending(null)
    if (!result.ok) toast.error(result.error)
  }

  return (
    <>
      {waiting.length > 0 && (
        <Alert data-testid="run-waiting">
          <AlertTitle>Waiting for approval</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {waiting.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-2">
                <span className="font-mono text-xs">{t.id}</span>
                <Button
                  size="sm"
                  data-testid="task-approve"
                  disabled={pending !== null}
                  onClick={() => void onApprove(t.id)}
                >
                  Approve
                </Button>
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <ButtonGroup>
        <ActionButton
          size="sm"
          variant="destructive"
          data-testid="run-cancel"
          pending={pending === "cancel"}
          disabled={!live}
          disabledReason="Run is not live"
          onClick={() => setCancelOpen(true)}
        >
          Cancel
        </ActionButton>
        <ButtonGroupSeparator />
        <ActionButton
          size="sm"
          data-testid="run-rerun"
          pending={pending === "rerun"}
          disabled={live}
          disabledReason="Cancel or wait for the run to finish"
          tooltip="Starts a new run from the current workflow.yaml (may differ from this run's frozen graph)"
          onClick={() => void onRerun()}
        >
          Rerun
        </ActionButton>
        <ButtonGroupSeparator />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                variant="outline"
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
      </ButtonGroup>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this run?"
        description="Running tasks are stopped. Finished task outputs are kept."
        confirmLabel="Cancel run"
        cancelLabel="Keep running"
        pending={pending === "cancel"}
        onConfirm={() => void onCancel()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete run ${run.id}?`}
        description={
          <>
            Started {run.startedAt}. Removes the run directory runs/{run.id}/:
            graph.json, every task&apos;s input/, all attempt dirs with out/,
            SUMMARY.md, stdout.log and stderr.log. The run disappears from
            lists. Workflow files are not touched. Cannot be undone.
          </>
        }
        confirmLabel="Delete run"
        pending={pending === "delete"}
        onConfirm={() => void onDelete()}
      />
    </>
  )
}

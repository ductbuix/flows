import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { api } from "@/lib/api"

type Props = {
  open: boolean
  workflowId: string
  runCount: number
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteWorkflowDialog({
  open,
  workflowId,
  runCount,
  onOpenChange,
  onDeleted,
}: Props) {
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    if (confirm !== workflowId) {
      setError("Type the workflow id to confirm.")
      return
    }
    setBusy(true)
    try {
      const res = await api.workflows[":workflowId"].$delete({
        param: { workflowId },
      })
      if (res.status === 409) {
        setError("Delete blocked while a run is live.")
        return
      }
      if (!res.ok && res.status !== 204) {
        setError("Could not delete workflow.")
        return
      }
      onDeleted()
      onOpenChange(false)
    } catch {
      setError("Could not delete workflow.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setConfirm("")
        onOpenChange(next)
      }}
    >
      <AlertDialogContent
        data-testid="workflow-delete"
        className="sm:max-w-md"
        size="default"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete workflow</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. The workflow has {runCount} run
            {runCount === 1 ? "" : "s"} in history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-inside list-disc space-y-1 text-left text-sm text-muted-foreground">
          <li>
            The whole dir workflows/{workflowId}/: workflow.yaml, memory/,
            input/, output/, SUMMARY.md and every run under runs/.
          </li>
          <li>Its run history in the app.</li>
        </ul>
        <Field>
          <FieldLabel htmlFor="delete-confirm">
            Type {workflowId} to confirm
          </FieldLabel>
          <Input
            id="delete-confirm"
            data-testid="delete-confirm-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="delete-submit"
            variant="destructive"
            disabled={busy || confirm !== workflowId}
            onClick={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

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
import { workflowIdSchema } from "@workspace/shared"
import { api } from "@/lib/api"

type Props = {
  open: boolean
  workflowId: string
  onOpenChange: (open: boolean) => void
  onRenamed: (newId: string) => void
}

export function RenameWorkflowDialog({
  open,
  workflowId,
  onOpenChange,
  onRenamed,
}: Props) {
  const [newId, setNewId] = useState(workflowId)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    const parsed = workflowIdSchema.safeParse(newId.trim())
    if (!parsed.success) {
      setError("Id must be lowercase letters, digits and dashes.")
      return
    }
    setBusy(true)
    try {
      const res = await api.workflows[":workflowId"].rename.$post({
        param: { workflowId },
        json: { newId: parsed.data },
      })
      if (res.status === 409) {
        setError("Rename blocked: a live run exists, or the id is taken.")
        return
      }
      if (!res.ok) {
        setError("Could not rename workflow.")
        return
      }
      onRenamed(parsed.data)
      onOpenChange(false)
    } catch {
      setError("Could not rename workflow.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setNewId(workflowId)
        onOpenChange(next)
      }}
    >
      <AlertDialogContent
        data-testid="workflow-rename"
        className="sm:max-w-md"
        size="default"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Rename workflow</AlertDialogTitle>
          <AlertDialogDescription>
            Renaming changes the directory name and the id in workflow.yaml.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-inside list-disc space-y-1 text-left text-sm text-muted-foreground">
          <li>
            The dir moves from workflows/{workflowId}/ to workflows/
            {newId || "…"}/, with its runs, inputs, outputs and memory.
          </li>
          <li>
            id: in workflow.yaml changes; the rest of the file stays untouched.
          </li>
          <li>
            Past runs stay in history under the new id, but paths recorded
            inside them (logs, SUMMARY.md, task outputs, WF_DIR) still point to
            the old dir.
          </li>
          <li>
            Scripts or tools outside the app that use the old path stop working.
          </li>
        </ul>
        <Field>
          <FieldLabel htmlFor="rename-id">New id</FieldLabel>
          <Input
            id="rename-id"
            data-testid="rename-id-input"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="rename-submit"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            Rename
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

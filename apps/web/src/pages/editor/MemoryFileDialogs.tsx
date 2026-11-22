import { useState } from "react"
import type { MemoryFileSummary } from "@workspace/shared"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldLabel } from "@workspace/ui/components/field"
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
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { api } from "@/lib/api"

type Props = {
  workflowId: string
  pendingDelete: MemoryFileSummary | null
  pendingRename: MemoryFileSummary | null
  onClearDelete: () => void
  onClearRename: () => void
  onChanged: () => void
  onError: (message: string) => void
}

export function MemoryFileDialogs({
  workflowId,
  pendingDelete,
  pendingRename,
  onClearDelete,
  onClearRename,
  onChanged,
  onError,
}: Props) {
  const [renameTo, setRenameTo] = useState("")

  async function confirmDelete() {
    if (!pendingDelete) return
    await api.workflows[":workflowId"].memory[":file"].$delete({
      param: { workflowId, file: pendingDelete.name },
    })
    onClearDelete()
    onChanged()
  }

  async function confirmRename(updateReferences: boolean) {
    if (!pendingRename) return
    const res = await api.workflows[":workflowId"].memory[":file"].rename.$post(
      {
        param: { workflowId, file: pendingRename.name },
        json: { newName: renameTo.trim(), updateReferences },
      }
    )
    if (!res.ok) {
      onError("Could not rename memory file.")
      return
    }
    onClearRename()
    onChanged()
  }

  return (
    <>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && onClearDelete()}
      >
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.referencedBy.length > 0
                ? `Referenced by tasks: ${pendingDelete.referencedBy.join(", ")}. Those tasks will fail validation until fixed.`
                : "No tasks reference this file."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(pendingRename)}
        onOpenChange={(open) => {
          if (open && pendingRename) setRenameTo(pendingRename.name)
          if (!open) onClearRename()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {pendingRename?.name}</DialogTitle>
            <DialogDescription>
              {pendingRename && pendingRename.referencedBy.length > 0
                ? `Referenced by tasks: ${pendingRename.referencedBy.join(", ")}.`
                : "No tasks reference this file."}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="memory-rename">New name</FieldLabel>
            <Input
              id="memory-rename"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => onClearRename()}>
              Cancel
            </Button>
            {pendingRename && pendingRename.referencedBy.length > 0 && (
              <Button
                onClick={() => void confirmRename(true)}
              >
                Rename and update refs
              </Button>
            )}
            <Button
              onClick={() => void confirmRename(false)}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

import { useEffect, useState } from "react"
import { memoryFileDetailSchema } from "@workspace/shared"
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
import { api } from "@/lib/api"
import { FileEditorDialog } from "./FileEditorDialog"

type Props = {
  workflowId: string
  fileName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onRemoved: () => void
}

export function MemoryEditorDialog({
  workflowId,
  fileName,
  open,
  onOpenChange,
  onSaved,
  onRemoved,
}: Props) {
  const [content, setContent] = useState("")
  const [hash, setHash] = useState("")
  const [referencedBy, setReferencedBy] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    void (async () => {
      const res = await api.workflows[":workflowId"].memory[":file"].$get({
        param: { workflowId, file: fileName },
      })
      if (!res.ok || !alive) return
      const detail = memoryFileDetailSchema.parse(await res.json())
      setContent(detail.content)
      setHash(detail.hash)
      setReferencedBy(detail.referencedBy)
      setError(null)
    })()
    return () => {
      alive = false
    }
  }, [open, workflowId, fileName])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.workflows[":workflowId"].memory[":file"].$put({
        param: { workflowId, file: fileName },
        json: { content, baseHash: hash },
      })
      if (res.status === 409) {
        setError("File changed on disk. Reload and try again.")
        return
      }
      if (!res.ok) {
        setError("Could not save.")
        return
      }
      const detail = memoryFileDetailSchema.parse(await res.json())
      setHash(detail.hash)
      onSaved()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.workflows[":workflowId"].memory[":file"].$delete({
        param: { workflowId, file: fileName },
      })
      if (!res.ok) {
        setError("Could not remove.")
        return
      }
      setConfirmRemove(false)
      onRemoved()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <FileEditorDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Edit memory file"
        path={fileName}
        description="Edits apply to future launches only. Running and past attempts keep the copy they got."
        editorTestId="memory-editor"
        saveTestId="memory-save"
        removeTestId="memory-remove"
        content={content}
        onContentChange={setContent}
        error={error}
        busy={busy}
        onSave={() => void save()}
        onRemove={() => setConfirmRemove(true)}
      />
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {fileName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {referencedBy.length > 0
                ? `Referenced by tasks: ${referencedBy.join(", ")}. Those tasks will fail validation until fixed.`
                : "No tasks reference this file."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void remove()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

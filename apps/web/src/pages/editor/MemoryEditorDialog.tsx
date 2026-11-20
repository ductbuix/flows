import { useEffect, useMemo, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { markdown } from "@codemirror/lang-markdown"
import { memoryFileDetailSchema } from "@workspace/shared"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { api } from "@/lib/api"

type Props = {
  workflowId: string
  fileName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function MemoryEditorDialog({
  workflowId,
  fileName,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [content, setContent] = useState("")
  const [hash, setHash] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const extensions = useMemo(() => [markdown()], [])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="memory-editor">
        <DialogHeader>
          <DialogTitle className="font-mono">{fileName}</DialogTitle>
          <DialogDescription>
            Edits apply to future launches only. Running and past attempts keep
            the copy they got.
          </DialogDescription>
        </DialogHeader>
        <CodeMirror
          value={content}
          height="280px"
          extensions={extensions}
          onChange={setContent}
          basicSetup={{ lineNumbers: true }}
          className="overflow-hidden rounded-md border text-xs"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="memory-save"
            disabled={busy}
            onClick={() => void save()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

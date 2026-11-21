import { useEffect, useState } from "react"
import {
  isAllowedWorkflowFilePath,
  workflowFileDetailSchema,
} from "@workspace/shared"
import { api } from "@/lib/api"
import { FileEditorDialog } from "./FileEditorDialog"

type Props = {
  workflowId: string
  path: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function PromptEditorDialog({
  workflowId,
  path,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [content, setContent] = useState("")
  const [hash, setHash] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    void (async () => {
      setError(null)
      if (!isAllowedWorkflowFilePath(path)) {
        setContent("")
        setHash(undefined)
        setError("Path must stay inside the workflow dir.")
        return
      }
      const res = await api.workflows[":workflowId"].files[":path"].$get({
        param: { workflowId, path },
      })
      if (!alive) return
      if (res.status === 404) {
        setContent("")
        setHash(undefined)
        return
      }
      if (!res.ok) {
        setError("Could not load file.")
        return
      }
      const detail = workflowFileDetailSchema.parse(await res.json())
      setContent(detail.content)
      setHash(detail.hash)
    })()
    return () => {
      alive = false
    }
  }, [open, workflowId, path])

  async function save() {
    if (!isAllowedWorkflowFilePath(path)) {
      setError("Path must stay inside the workflow dir.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.workflows[":workflowId"].files[":path"].$put({
        param: { workflowId, path },
        json: hash === undefined ? { content } : { content, baseHash: hash },
      })
      if (res.status === 409) {
        setError("File changed on disk. Reload and try again.")
        return
      }
      if (!res.ok) {
        setError("Could not save.")
        return
      }
      const detail = workflowFileDetailSchema.parse(await res.json())
      setHash(detail.hash)
      onSaved?.()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <FileEditorDialog
      open={open}
      onOpenChange={onOpenChange}
      title={path}
      description="Prompt for this agent task. Saving creates the file if it is missing."
      editorTestId="prompt-editor"
      saveTestId="prompt-save"
      content={content}
      onContentChange={setContent}
      error={error}
      busy={busy}
      onSave={() => void save()}
    />
  )
}

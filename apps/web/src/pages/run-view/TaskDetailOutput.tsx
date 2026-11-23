import { useEffect, useState } from "react"
import { outListSchema, runInputFileDetailSchema } from "@workspace/shared"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { FileTree, pathsToFileTree } from "@workspace/ui/components/file-tree"
import { mono } from "@/components/data/mono"
import { api } from "@/lib/api"

type Props = {
  runId: string
  taskId: string
  attemptN: number
}

export function TaskDetailOutput({ runId, taskId, attemptN }: Props) {
  const slot = `${runId}:${taskId}:${attemptN}`
  const [state, setState] = useState<{ slot: string; files: string[] } | null>(
    null
  )
  const [selected, setSelected] = useState<string | undefined>()
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const loading = state === null || state.slot !== slot

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.runs[":runId"].tasks[":taskId"].attempts[
        ":n"
      ].out.$get({
        param: { runId, taskId, n: String(attemptN) },
      })
      if (!res.ok || !alive) return
      const out = outListSchema.parse(await res.json())
      setState({
        slot,
        files: out.files.filter((f) => f.type === "file").map((f) => f.path),
      })
    })()
    return () => {
      alive = false
    }
  }, [runId, taskId, attemptN, slot])

  async function openPreview(path: string) {
    setSelected(path)
    setPreviewPath(path)
    setPreviewContent("")
    setPreviewError(null)
    setPreviewLoading(true)
    const res = await api.runs[":runId"].tasks[":taskId"].attempts[":n"].out[
      ":path"
    ].$get({
      param: {
        runId,
        taskId,
        n: String(attemptN),
        path,
      },
    })
    setPreviewLoading(false)
    if (!res.ok) {
      setPreviewError("Could not load file.")
      return
    }
    const detail = runInputFileDetailSchema.parse(await res.json())
    setPreviewContent(detail.content)
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading output…</p>
  }

  if (state!.files.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No output files</EmptyTitle>
        <EmptyDescription>The out/ folder is empty.</EmptyDescription>
        <EmptyContent />
      </Empty>
    )
  }

  return (
    <>
      <FileTree
        roots={pathsToFileTree(state!.files)}
        selected={selected}
        onSelect={(path) => void openPreview(path)}
        data-testid="out-file-tree"
      />
      <Dialog
        open={previewPath !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPath(null)
        }}
      >
        <DialogContent className="sm:max-w-xl" data-testid="out-file-preview">
          <DialogHeader>
            <DialogTitle>Output file</DialogTitle>
            <DialogDescription className={`${mono} text-xs`}>
              {previewPath}
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : previewError ? (
            <Alert variant="destructive">
              <AlertDescription>{previewError}</AlertDescription>
            </Alert>
          ) : (
            <div className="max-h-96 overflow-auto rounded-lg border">
              <pre
                className={`${mono} p-3 text-xs whitespace-pre-wrap`}
                data-testid="out-file-preview-content"
              >
                {previewContent}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

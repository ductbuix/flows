import { useState } from "react"
import { runInputFileDetailSchema } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { api } from "@/lib/api"

type Props = {
  runId: string
  files: string[]
}

function sanitizeTestId(path: string): string {
  return path.replace(/[^a-zA-Z0-9_-]+/g, "-")
}

function isTextPreview(path: string): boolean {
  const base = path.split("/").pop() ?? path
  if (base === "inputs.json") return true
  return /\.(txt|md)$/i.test(base)
}

function downloadHref(runId: string, path: string): string {
  const encoded = path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")
  return `/api/runs/${encodeURIComponent(runId)}/input/files/${encoded}?download=1`
}

export function RunInputFiles({ runId, files }: Props) {
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  async function openPreview(path: string) {
    setPreviewPath(path)
    setPreviewContent("")
    setPreviewError(null)
    setLoading(true)
    const res = await api.runs[":runId"].input.files[":path"].$get({
      param: { runId, path },
    })
    setLoading(false)
    if (!res.ok) {
      setPreviewError("Could not load file.")
      return
    }
    const detail = runInputFileDetailSchema.parse(await res.json())
    setPreviewContent(detail.content)
  }

  return (
    <section data-testid="run-inputs" className="space-y-1">
      <h2 className="text-xs font-medium text-muted-foreground">Run input</h2>
      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground">No input files.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {files.map((path) => (
            <li key={path}>
              {isTextPreview(path) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 font-mono text-xs"
                  data-testid={`run-input-file-${sanitizeTestId(path)}`}
                  onClick={() => void openPreview(path)}
                >
                  {path}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 font-mono text-xs"
                  data-testid={`run-input-file-${sanitizeTestId(path)}`}
                  render={<a href={downloadHref(runId, path)} download />}
                >
                  {path}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={previewPath !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPath(null)
        }}
      >
        <DialogContent className="max-w-2xl" data-testid="run-input-preview">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {previewPath}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : previewError ? (
            <p className="text-sm text-destructive">{previewError}</p>
          ) : (
            <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
              {previewContent}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

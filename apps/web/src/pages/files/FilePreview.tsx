import { useState } from "react"
import { FileText } from "lucide-react"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import { mono } from "@/components/data/mono"
import { errorMessage, isConflictError } from "@/lib/fcp-error"
import { FilePreviewHeader, MarkdownViews } from "./FilePreviewParts"

type Props = {
  path: string | null
  homeLabel: string
}

export function FilePreview({ path, homeLabel }: Props) {
  if (!path) {
    return (
      <Empty data-testid="files-empty">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No file selected</EmptyTitle>
          <EmptyDescription>
            Pick a file on the left to read it.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return <FilePreviewBody key={path} path={path} homeLabel={homeLabel} />
}

function FilePreviewBody({
  path,
  homeLabel,
}: {
  path: string
  homeLabel: string
}) {
  const client = useFlowsClient()
  const { data, error, loading } = useQuery(
    "file/read_text",
    { path },
    { topics: [] }
  )
  const [draft, setDraft] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [view, setView] = useState<"raw" | "preview">("preview")
  const [copied, setCopied] = useState<"path" | "contents" | null>(null)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const text = draft ?? data?.text ?? ""
  const baseHash = hash ?? data?.hash ?? ""
  const dirty = draft !== null && data !== undefined && draft !== data.text
  const full = `~/${homeLabel}/${path}`
  const isMarkdown = path.endsWith(".md")

  async function save() {
    setPending(true)
    setConflict(false)
    setSaveError(null)
    try {
      const result = await client.call("file/write_text", {
        path,
        text,
        baseHash,
      })
      setHash(result.hash)
      setDraft(text)
    } catch (err) {
      if (isConflictError(err)) setConflict(true)
      else setSaveError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  if (loading && !data) {
    return (
      <div
        className="flex flex-col gap-3 p-4"
        data-testid="files-preview-loading"
      >
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <Alert
        variant="destructive"
        className="m-4"
        data-testid="files-preview-error"
      >
        <AlertTitle>Could not read file</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-4 p-4"
      data-testid="files-preview"
    >
      <FilePreviewHeader
        path={path}
        full={full}
        homeLabel={homeLabel}
        text={text}
        dirty={dirty}
        pending={pending}
        copied={copied}
        onCopy={setCopied}
        onSave={() => void save()}
      />
      {(conflict || saveError) && (
        <Alert variant="destructive" data-testid="files-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not save"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "This file changed on disk. Reload the page and try again."
              : saveError}
          </AlertDescription>
        </Alert>
      )}
      <Textarea
        className={`min-h-40 text-xs ${mono}`}
        value={text}
        data-testid="files-editor"
        onChange={(e) => setDraft(e.target.value)}
      />
      {isMarkdown ? (
        <MarkdownViews view={view} text={text} onView={setView} />
      ) : null}
    </div>
  )
}

import { Check, ChevronRight, Copy, FolderOpen } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { mono } from "@/components/data/mono"
import { SummaryMarkdown } from "@/components/SummaryMarkdown"

export function FilePreviewHeader({
  path,
  full,
  homeLabel,
  text,
  metaLine,
  dirty,
  pending,
  revealing,
  copied,
  onCopy,
  onSave,
  onReveal,
}: {
  path: string
  full: string
  homeLabel: string
  text: string
  metaLine: string | null
  dirty: boolean
  pending: boolean
  revealing: boolean
  copied: "path" | "contents" | null
  onCopy: (v: "path" | "contents" | null) => void
  onSave: () => void
  onReveal: () => void
}) {
  const copyButton = (
    what: "path" | "contents",
    label: string,
    value: string
  ) => (
    <Button
      variant="outline"
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        onCopy(what)
        setTimeout(() => onCopy(null), 1500)
      }}
    >
      {copied === what ? <Check /> : <Copy />}
      {copied === what ? "Copied" : label}
    </Button>
  )
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate font-heading text-base font-medium">
          {path.split("/").pop()}
        </h2>
        {copyButton("path", "Copy path", full)}
        {text ? copyButton("contents", "Copy contents", text) : null}
        <Button
          variant="outline"
          data-testid="files-reveal"
          disabled={revealing}
          onClick={onReveal}
        >
          <FolderOpen />
          Reveal in Finder
        </Button>
        <Button
          data-testid="files-save"
          disabled={!dirty || pending}
          onClick={onSave}
        >
          Save
        </Button>
      </div>
      <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
        {[`~/${homeLabel}`, ...path.split("/").slice(0, -1)].map((seg, i) => (
          <span key={`${seg}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <ChevronRight className="size-3" /> : null}
            {seg}
          </span>
        ))}
      </span>
      {metaLine ? (
        <span className="text-xs text-muted-foreground" data-testid="files-stat">
          {metaLine}
        </span>
      ) : null}
    </div>
  )
}

export function MarkdownViews({
  view,
  text,
  onView,
}: {
  view: "raw" | "preview"
  text: string
  onView: (v: "raw" | "preview") => void
}) {
  return (
    <>
      <ToggleGroup
        value={[view]}
        onValueChange={(v) => v[0] && onView(v[0] as "raw" | "preview")}
        className="w-fit"
      >
        <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
        <ToggleGroupItem value="raw">Raw</ToggleGroupItem>
      </ToggleGroup>
      {view === "preview" ? (
        <div
          className="min-h-0 flex-1 overflow-auto"
          data-testid="files-markdown"
        >
          <SummaryMarkdown text={text.replace(/^---[\s\S]*?---\n/, "")} />
        </div>
      ) : (
        <pre className={`min-h-0 flex-1 overflow-auto text-xs ${mono}`}>
          {text}
        </pre>
      )}
    </>
  )
}

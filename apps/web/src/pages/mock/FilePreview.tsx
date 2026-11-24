import { useState } from "react"
import { Check, ChevronRight, Copy, FileText } from "lucide-react"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { SummaryMarkdown } from "@/pages/run-view/SummaryMarkdown"
import { Button } from "@workspace/ui/components/button"
import { CodeBlock } from "@workspace/ui/components/code-block"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { mono } from "@/components/data/mono"
import { contentOf, metaOf } from "./file-contents"
import { FLOWAPP_ROOT } from "./mock-data"

export function FilePreview({ path }: { path: string | null }) {
  const [copied, setCopied] = useState<"path" | "contents" | null>(null)
  const [view, setView] = useState<"raw" | "preview">("preview")
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
  const copyButton = (
    what: "path" | "contents",
    label: string,
    text: string
  ) => (
    <Button
      variant="outline"
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setCopied(what)
        setTimeout(() => setCopied(null), 1500)
      }}
    >
      {copied === what ? <Check /> : <Copy />}
      {copied === what ? "Copied" : label}
    </Button>
  )
  const content = contentOf(path)
  const raw = (
    <CodeBlock className="min-h-0 flex-1 overflow-auto">
      <div className={`flex gap-3 p-3 text-xs ${mono}`}>
        <pre
          aria-hidden
          className="text-right text-muted-foreground select-none"
        >
          {content
            .trimEnd()
            .split("\n")
            .map((_, i) => i + 1)
            .join("\n")}
        </pre>
        <pre className="min-w-0 flex-1 whitespace-pre-wrap">{content}</pre>
      </div>
    </CodeBlock>
  )
  const meta = metaOf(path)
  const isMarkdown = path.endsWith(".md")
  const full = `~/${FLOWAPP_ROOT}/${path}`
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-4 p-4"
      data-testid="files-preview"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate font-heading text-base font-medium">
            {path.split("/").pop()}
          </h2>
          {copyButton("path", "Copy path", full)}
          {meta.binary || content === ""
            ? null
            : copyButton("contents", "Copy contents", content)}
        </div>
        <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          {[`~/${FLOWAPP_ROOT}`, ...path.split("/").slice(0, -1)].map(
            (seg, i) => (
              <span key={`${seg}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3" /> : null}
                {seg}
              </span>
            )
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {meta.kind} · {meta.size} · Modified {meta.modified}
        </span>
      </div>
      {meta.binary ? (
        <p className="text-sm text-muted-foreground">
          Binary file. It cannot be shown here.
        </p>
      ) : content === "" ? (
        <p className="text-sm text-muted-foreground">This file is empty.</p>
      ) : isMarkdown ? (
        <>
          <ToggleGroup
            value={[view]}
            onValueChange={(v) => v[0] && setView(v[0] as "raw" | "preview")}
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
              <SummaryMarkdown
                text={content.replace(/^---[\s\S]*?---\n/, "")}
              />
            </div>
          ) : (
            raw
          )}
        </>
      ) : (
        raw
      )}
    </div>
  )
}

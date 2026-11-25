import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { mono as monoClass } from "@/components/data/mono"
import { useFlow } from "./flow-context"
import { nodeFilePath, useNodeFile } from "./use-node-file"

const AREA =
  "nodrag nowheel nopan block w-full resize-none rounded-2xl bg-muted/60 px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default"

type AreaProps = {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder: string
  label: string
  rows?: number
  mono?: boolean
  testId?: string
}

function Area({
  value,
  onChange,
  onBlur,
  placeholder,
  label,
  rows = 3,
  mono,
  testId,
}: AreaProps) {
  const { readOnly } = useFlow()
  return (
    <textarea
      aria-label={label}
      className={cn(AREA, mono && cn(monoClass, "text-xs"))}
      rows={rows}
      value={value}
      placeholder={placeholder}
      disabled={readOnly}
      spellCheck={!mono}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => e.stopPropagation()}
      data-testid={testId}
    />
  )
}

type FileFieldProps = {
  nodeId: string
  file: string
  label: string
  placeholder: string
  rows?: number
}

/** Edits a node file in place (`prompt.md`, `rule.md`, `text.md`). */
export function NodeFileField({
  nodeId,
  file,
  label,
  placeholder,
  rows,
}: FileFieldProps) {
  const { workflowId } = useFlow()
  const doc = useNodeFile(
    workflowId ? nodeFilePath(workflowId, nodeId, file) : null
  )
  return (
    <Area
      label={label}
      placeholder={doc.loaded ? placeholder : "Loading…"}
      rows={rows}
      value={doc.text}
      onChange={doc.change}
      onBlur={doc.flush}
      testId={`node-field-${file.replace(/\.md$/, "")}`}
    />
  )
}

type YamlFieldProps = {
  value: string
  label: string
  placeholder: string
  rows?: number
  mono?: boolean
  testId?: string
  /** Called on blur with the trimmed draft when it changed. */
  onCommit: (v: string) => void
}

/** Edits one workflow.yaml key; writes on blur so undo keeps one step. */
export function NodeYamlField({ value, onCommit, ...rest }: YamlFieldProps) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }
  return (
    <Area
      {...rest}
      value={draft}
      onChange={setDraft}
      onBlur={() => {
        if (draft.trim() !== value.trim()) onCommit(draft.trim())
      }}
    />
  )
}

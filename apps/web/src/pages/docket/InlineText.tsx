import { useRef, useState } from "react"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

type Props = {
  value: string
  onSave: (value: string) => void
  /** Accessible name, also used as "Edit <label>". */
  label: string
  placeholder?: string
  multiline?: boolean
  type?: "text" | "date"
  /** How the value reads when not editing. */
  format?: (value: string) => string
  className?: string
}

/** Reads as plain text; becomes an input only after a click. */
export function InlineText({
  value,
  onSave,
  label,
  placeholder = "Empty",
  multiline,
  type = "text",
  format,
  className,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)

  function start() {
    cancelled.current = false
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    if (!cancelled.current && draft !== value) onSave(draft)
  }

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Edit ${label}`}
        onClick={start}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            start()
          }
        }}
        className={cn(
          "-mx-2 flex min-h-8 w-full cursor-text rounded-md px-2 text-left break-words whitespace-pre-wrap outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          multiline ? "items-start py-1.5" : "items-center",
          !value && "text-muted-foreground",
          className
        )}
      >
        {value ? (format ? format(value) : value) : placeholder}
      </div>
    )
  }

  const shared = {
    autoFocus: true,
    value: draft,
    "aria-label": label,
    onBlur: commit,
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      cancelled.current = true
      setEditing(false)
    } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      commit()
    }
  }

  return multiline ? (
    <Textarea
      {...shared}
      rows={6}
      onKeyDown={onKeyDown}
      onChange={(e) => setDraft(e.target.value)}
    />
  ) : (
    <Input
      {...shared}
      type={type}
      className={className}
      onKeyDown={onKeyDown}
      onChange={(e) => setDraft(e.target.value)}
    />
  )
}

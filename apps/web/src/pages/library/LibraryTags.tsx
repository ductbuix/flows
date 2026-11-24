import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { LibItem } from "@workspace/contracts"
import { splitTag } from "./library-filter"

/** `namespace:value`, the namespace muted. */
export function TagBadge({
  tag,
  active,
  onClick,
  onRemove,
}: {
  tag: string
  active?: boolean
  onClick?: () => void
  onRemove?: () => void
}) {
  const [ns, value] = splitTag(tag)
  const body = (
    <>
      <span className={active ? "opacity-70" : "text-muted-foreground"}>
        {ns ? `${ns}:` : null}
      </span>
      {value}
    </>
  )
  return (
    <span className="inline-flex items-center gap-0.5">
      {onClick ? (
        <Badge
          variant={active ? "default" : "outline"}
          render={<button type="button" onClick={onClick} />}
        >
          {body}
        </Badge>
      ) : (
        <Badge variant="outline">
          {body}
          {onRemove ? (
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={onRemove}
              className="-mr-1 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </Badge>
      )}
    </span>
  )
}

/** Left rail: every tag grouped by namespace with counts. Selected tags AND together. */
export function TagRail({
  items,
  active,
  onToggle,
}: {
  items: readonly LibItem[]
  active: readonly string[]
  onToggle: (tag: string) => void
}) {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const t of item.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  const groups = new Map<string, string[]>()
  for (const t of [...counts.keys()].sort()) {
    const ns = splitTag(t)[0] || "tag"
    groups.set(ns, [...(groups.get(ns) ?? []), t])
  }
  if (groups.size === 0) {
    return (
      <p
        className="px-2 text-sm text-muted-foreground"
        data-testid="library-tag-rail"
      >
        No tags yet
      </p>
    )
  }
  return (
    <nav
      className="flex flex-col gap-4"
      aria-label="Tags"
      data-testid="library-tag-rail"
    >
      {[...groups.entries()].map(([ns, tags]) => (
        <div key={ns} className="flex flex-col gap-0.5">
          <h3 className="px-2 text-xs font-medium text-muted-foreground">
            {ns}
          </h3>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={active.includes(t)}
              onClick={() => onToggle(t)}
              className="flex min-h-8 items-center justify-between gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted aria-pressed:font-medium"
            >
              <span className="truncate">{splitTag(t)[1]}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {counts.get(t)}
              </span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Tags of one item with remove buttons and an add field (`namespace:value`). */
export function TagEditor({
  tags,
  onAdd,
  onRemove,
}: {
  tags: readonly string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}) {
  const [draft, setDraft] = useState("")
  const ok = /^[a-z0-9-]+:[^\s:]+$/i.test(draft.trim())
  function add() {
    if (!ok) return
    onAdd(draft.trim())
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-2" data-testid="library-tag-editor">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <TagBadge key={t} tag={t} onRemove={() => onRemove(t)} />
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add tag, like epic:EP7"
          data-testid="library-tag-input"
        />
        <Button type="submit" variant="outline" disabled={!ok}>
          <Plus />
          Add
        </Button>
      </form>
    </div>
  )
}

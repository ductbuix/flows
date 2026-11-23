import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { TONE_TEXT } from "@/components/brand/StatusPill"
import type { Card, Column, Tone } from "./docket-data"

const TONES: { value: Tone; label: string }[] = [
  { value: "idle", label: "Idle" },
  { value: "working", label: "Working" },
  { value: "attention", label: "Attention" },
  { value: "done", label: "Done" },
]

type Props = {
  open: boolean
  columns: Column[]
  cards: Card[]
  onOpenChange: (open: boolean) => void
  /** `moves` maps a deleted column id to the column its cards go to. */
  onSave: (columns: Column[], moves: Record<string, string>) => void
}

function slug(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "column"
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

export function ColumnsDialog({ open, columns, cards, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState<Column[]>(columns)
  const [moves, setMoves] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  function reset(next: boolean) {
    if (next) setDraft(columns)
    setMoves({})
    setError(null)
    onOpenChange(next)
  }

  const patch = (id: string, p: Partial<Column>) =>
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const shift = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      const next = [...d]
      ;[next[i], next[i + by]] = [next[i + by]!, next[i]!]
      return next
    })
  const countIn = (id: string) => cards.filter((c) => c.status === id).length

  function remove(id: string) {
    const rest = draft.filter((c) => c.id !== id)
    // Cards of a column that only exists in this draft need no move.
    const real = columns.some((c) => c.id === id)
    if (real && countIn(id) > 0) {
      setMoves((m) => ({ ...m, [id]: m[id] ?? rest[0]!.id }))
    }
    setDraft(rest)
  }

  function save() {
    if (draft.some((c) => !c.label.trim())) {
      setError("Every column needs a name.")
      return
    }
    onSave(draft.map((c) => ({ ...c, label: c.label.trim() })), moves)
    reset(false)
  }

  const gone = columns.filter((c) => !draft.some((d) => d.id === c.id) && countIn(c.id) > 0)

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-xl" data-testid="docket-columns">
        <DialogHeader>
          <DialogTitle>Columns</DialogTitle>
          <DialogDescription>
            Rename, reorder and add columns. A column id never changes, so
            renaming is safe. Mark a column Done when cards there are finished.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {draft.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1.5" data-testid={`columns-row-${c.id}`}>
              <div className="flex">
                <Button variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => shift(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Move down" disabled={i === draft.length - 1} onClick={() => shift(i, 1)}>
                  <ArrowDown />
                </Button>
              </div>
              <Input
                aria-label="Column name"
                className="min-w-0 flex-1"
                value={c.label}
                onChange={(e) => patch(c.id, { label: e.target.value })}
              />
              <Select
                value={c.tone}
                items={TONES}
                onValueChange={(v) => v && patch(c.id, { tone: v as Tone })}
              >
                <SelectTrigger className={`w-32 ${TONE_TEXT[c.tone]}`} aria-label="Tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={!!c.done}
                  onCheckedChange={(v) => patch(c.id, { done: v === true })}
                />
                Done
              </label>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${c.label}`}
                disabled={draft.length === 1}
                onClick={() => remove(c.id)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            className="w-fit text-muted-foreground"
            onClick={() =>
              setDraft((d) => [
                ...d,
                { id: slug("New column", [...d.map((x) => x.id), ...columns.map((x) => x.id)]), label: "New column", tone: "idle" },
              ])
            }
          >
            <Plus />
            Add column
          </Button>
        </div>
        {gone.map((g) => (
          <div key={g.id} className="flex items-center gap-2 rounded-2xl bg-muted/60 p-3 text-sm" data-testid={`columns-move-${g.id}`}>
            <span className="flex-1">
              Move {countIn(g.id)} {countIn(g.id) === 1 ? "card" : "cards"} from{" "}
              <strong>{g.label}</strong> to
            </span>
            <Select
              value={moves[g.id] ?? draft[0]!.id}
              items={draft.map((d) => ({ value: d.id, label: d.label }))}
              onValueChange={(v) => v && setMoves((m) => ({ ...m, [g.id]: v }))}
            >
              <SelectTrigger className="w-40" aria-label={`Move cards of ${g.label} to`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {draft.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button onClick={save} data-testid="columns-save">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

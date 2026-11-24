import { useState } from "react"
import type { Board, BoardColumn } from "@workspace/contracts"
import { Plus } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { ColumnEditorRow } from "./ColumnEditorRow"
import { toUiColumns, type UiColumn } from "./column-tone"

type Props = {
  open: boolean
  board: Board
  cardStatuses: string[]
  onOpenChange: (open: boolean) => void
  onSave: (board: Board, migrateStatus?: string) => Promise<void>
}

function slug(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "column"
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

export function ColumnsDialog({
  open,
  board,
  cardStatuses,
  onOpenChange,
  onSave,
}: Props) {
  const columns = toUiColumns(board.columns)
  const [draft, setDraft] = useState<UiColumn[]>(columns)
  const [migrateStatus, setMigrateStatus] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function reset(next: boolean) {
    if (next) {
      setDraft(toUiColumns(board.columns))
      setMigrateStatus(undefined)
      setError(null)
      setPending(false)
    }
    onOpenChange(next)
  }

  const patch = (id: string, p: Partial<UiColumn>) =>
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, ...p } : c)))

  const shift = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      const next = [...d]
      ;[next[i], next[i + by]] = [next[i + by]!, next[i]!]
      return next
    })

  const countIn = (id: string) =>
    cardStatuses.filter((status) => status === id).length

  function remove(id: string) {
    const rest = draft.filter((c) => c.id !== id)
    if (columns.some((c) => c.id === id) && countIn(id) > 0) {
      setMigrateStatus((m) => m ?? rest[0]?.id)
    }
    setDraft(rest)
  }

  async function save() {
    if (draft.some((c) => !c.label.trim())) {
      setError("Every column needs a name.")
      return
    }
    const nextColumns: BoardColumn[] = draft.map((c) => ({
      id: c.id,
      label: c.label.trim(),
      done: c.done,
      tone: c.tone,
    }))
    const removedWithCards = columns.filter(
      (c) => !draft.some((d) => d.id === c.id) && countIn(c.id) > 0
    )
    setPending(true)
    setError(null)
    try {
      await onSave(
        { ...board, columns: nextColumns },
        removedWithCards.length > 0 ? migrateStatus : undefined
      )
      reset(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPending(false)
    }
  }

  const gone = columns.filter(
    (c) => !draft.some((d) => d.id === c.id) && countIn(c.id) > 0
  )

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
            <ColumnEditorRow
              key={c.id}
              col={c}
              index={i}
              total={draft.length}
              onPatch={patch}
              onShift={shift}
              onRemove={remove}
            />
          ))}
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() =>
              setDraft((d) => [
                ...d,
                {
                  id: slug(
                    "column",
                    d.map((c) => c.id)
                  ),
                  label: "New column",
                  tone: "idle",
                },
              ])
            }
          >
            <Plus />
            Add column
          </Button>
        </div>
        {gone.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <p>Move cards from {gone.map((g) => g.label).join(", ")} into:</p>
            <Select
              value={migrateStatus ?? draft[0]?.id}
              items={draft.map((c) => ({ value: c.id, label: c.label }))}
              onValueChange={(v) => v && setMigrateStatus(v)}
            >
              <SelectTrigger data-testid="docket-columns-migrate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {draft.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button
            data-testid="docket-columns-save"
            disabled={pending}
            onClick={() => void save()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

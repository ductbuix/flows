import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { TONE_TEXT } from "@/components/brand/StatusPill"
import type { Tone, UiColumn } from "./column-tone"

const TONES: { value: Tone; label: string }[] = [
  { value: "idle", label: "Idle" },
  { value: "working", label: "Working" },
  { value: "attention", label: "Attention" },
  { value: "done", label: "Done" },
]

type Props = {
  col: UiColumn
  index: number
  total: number
  onPatch: (id: string, p: Partial<UiColumn>) => void
  onShift: (i: number, by: -1 | 1) => void
  onRemove: (id: string) => void
}

export function ColumnEditorRow({
  col,
  index,
  total,
  onPatch,
  onShift,
  onRemove,
}: Props) {
  return (
    <div
      className="flex items-center gap-1.5"
      data-testid={`columns-row-${col.id}`}
    >
      <div className="flex">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => onShift(index, -1)}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Move down"
          disabled={index === total - 1}
          onClick={() => onShift(index, 1)}
        >
          <ArrowDown />
        </Button>
      </div>
      <Input
        aria-label="Column name"
        className="min-w-0 flex-1"
        value={col.label}
        onChange={(e) => onPatch(col.id, { label: e.target.value })}
      />
      <Select
        value={col.tone}
        items={TONES}
        onValueChange={(v) => v && onPatch(col.id, { tone: v as Tone })}
      >
        <SelectTrigger
          className={`w-32 ${TONE_TEXT[col.tone]}`}
          aria-label="Tone"
        >
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
          checked={!!col.done}
          onCheckedChange={(v) => onPatch(col.id, { done: v === true })}
        />
        Done
      </label>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${col.label}`}
        disabled={total === 1}
        onClick={() => onRemove(col.id)}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

import type { BoardColumn } from "@workspace/contracts"

export type Tone = "idle" | "working" | "attention" | "done"

const TONES = new Set<Tone>(["idle", "working", "attention", "done"])

export type UiColumn = {
  id: string
  label: string
  tone: Tone
  done?: boolean
}

/** Map board.yaml columns to UI columns (tone is optional passthrough). */
export function toUiColumns(columns: BoardColumn[]): UiColumn[] {
  return columns.map((col) => ({
    id: col.id,
    label: col.label,
    done: col.done,
    tone: toneOf(col),
  }))
}

function toneOf(col: BoardColumn): Tone {
  if (col.done) return "done"
  const raw = (col as { tone?: unknown }).tone
  if (typeof raw === "string" && TONES.has(raw as Tone)) return raw as Tone
  return "idle"
}

export const DEFAULT_BOARD_COLUMNS = [
  { id: "todo", label: "Todo", tone: "idle" },
  { id: "doing", label: "Doing", tone: "working" },
  { id: "review", label: "Review", tone: "attention" },
  { id: "done", label: "Done", tone: "done", done: true },
] as BoardColumn[]

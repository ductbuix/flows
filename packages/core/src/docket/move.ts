import type { Board } from "@workspace/contracts"
import { rankBetween } from "./rank.ts"

export type MoveRankFace = {
  id: string
  status: string
  rank: string
}

/** Fractional rank for a card placed at `beforeId` in `status` (DES-038). */
export function computeMoveRank(
  faces: MoveRankFace[],
  cardId: string,
  status: string,
  beforeId?: string | null
): string {
  const column = faces
    .filter((face) => face.status === status && face.id !== cardId)
    .sort((a, b) => a.rank.localeCompare(b.rank))

  if (beforeId != null) {
    const insertAt = column.findIndex((face) => face.id === beforeId)
    if (insertAt >= 0) {
      const prev = insertAt > 0 ? column[insertAt - 1]!.rank : undefined
      const next = column[insertAt]!.rank
      return rankBetween(prev, next)
    }
  }

  const last = column.at(-1)?.rank
  return rankBetween(last, undefined)
}

/** Set or clear `done` when crossing a column flagged `done` (DES-038). */
export function doneForColumnMove(
  board: Board | null,
  fromStatus: string,
  toStatus: string,
  now: string
): string | null | undefined {
  if (fromStatus === toStatus) return undefined
  const fromCol = board?.columns.find((col) => col.id === fromStatus)
  const toCol = board?.columns.find((col) => col.id === toStatus)
  if (toCol?.done) return now
  if (fromCol?.done) return null
  return undefined
}

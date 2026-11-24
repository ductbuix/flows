import type { Board } from "@workspace/contracts"
import {
  compareRank,
  compareRankKey,
  rankBetween,
  type RankSortable,
} from "./rank.ts"

export type MoveRankFace = RankSortable & { status: string }

function tryRankBetween(lo?: string, hi?: string): string | undefined {
  try {
    return rankBetween(lo, hi)
  } catch {
    return undefined
  }
}

function rankAtEndOfSortedColumn(column: MoveRankFace[]): string {
  if (column.length === 0) return rankBetween()
  const last = column.at(-1)!
  return (
    tryRankBetween(last.rank === "" ? undefined : last.rank, undefined) ??
    tryRankBetween(last.rank, undefined) ??
    rankBetween()
  )
}

/** Fractional rank for a new card at the end of a column (DES-038). */
export function rankAtColumnEnd(faces: MoveRankFace[], status: string): string {
  const column = faces
    .filter((face) => face.status === status)
    .sort(compareRank)
  return rankAtEndOfSortedColumn(column)
}

function rankBoundTries(
  column: MoveRankFace[],
  insertAt: number
): Array<{ lo?: string; hi?: string }> {
  const anchor = column[insertAt]!
  const prev = insertAt > 0 ? column[insertAt - 1] : undefined
  const tries: Array<{ lo?: string; hi?: string }> = []
  if (prev) tries.push({ lo: prev.rank, hi: anchor.rank })
  tries.push({ lo: undefined, hi: anchor.rank })
  for (let i = insertAt - 1; i >= 0; i--) {
    const lo = column[i]!.rank
    if (lo < anchor.rank) tries.push({ lo, hi: anchor.rank })
  }
  for (let i = insertAt + 1; i < column.length; i++) {
    const hi = column[i]!.rank
    if (hi > anchor.rank) tries.push({ lo: anchor.rank, hi })
  }
  if (prev) tries.push({ lo: prev.rank, hi: undefined })
  tries.push({})
  return tries
}

function rankInsertBefore(
  column: MoveRankFace[],
  insertAt: number,
  cardId: string
): string {
  const anchor = column[insertAt]!
  const prev = insertAt > 0 ? column[insertAt - 1] : undefined

  if (
    prev &&
    prev.rank === anchor.rank &&
    prev.id < cardId &&
    cardId < anchor.id
  ) {
    return prev.rank
  }

  for (const { lo, hi } of rankBoundTries(column, insertAt)) {
    const rank = tryRankBetween(lo, hi)
    if (rank === undefined) continue
    if (prev && compareRankKey(rank, cardId, prev) <= 0) continue
    if (compareRankKey(rank, cardId, anchor) >= 0) continue
    return rank
  }

  return rankBetween()
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
    .sort(compareRank)

  if (beforeId != null) {
    const insertAt = column.findIndex((face) => face.id === beforeId)
    if (insertAt >= 0) {
      return rankInsertBefore(column, insertAt, cardId)
    }
  }

  return rankAtEndOfSortedColumn(column)
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

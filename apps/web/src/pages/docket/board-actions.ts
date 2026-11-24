import type { Board, WireCardFace } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"
import { DEFAULT_BOARD_COLUMNS } from "./column-tone"

export function rankCards(cards: WireCardFace[]): WireCardFace[] {
  return [...cards].sort((a, b) => {
    const byRank = a.rank.localeCompare(b.rank)
    return byRank !== 0 ? byRank : a.id.localeCompare(b.id)
  })
}

export async function ensureBoard(
  client: FlowsClient,
  board: Board | null,
  boardHash: string
): Promise<{ board: Board; hash: string }> {
  if (board && boardHash) return { board, hash: boardHash }
  const created: Board = {
    version: 1,
    columns: DEFAULT_BOARD_COLUMNS,
    face: [],
  }
  const result = await client.call("docket/save_board", {
    baseHash: boardHash,
    board: created,
  })
  return { board: created, hash: result.hash }
}

export async function moveCard(
  client: FlowsClient,
  cards: WireCardFace[],
  dragId: string,
  status: string,
  beforeId: string | null
): Promise<"ok" | "conflict" | string> {
  const face = cards.find((c) => c.id === dragId)
  if (!face) return "ok"
  try {
    await client.call("docket/move_card", {
      id: dragId,
      status,
      beforeId,
      baseHash: face.hash,
    })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

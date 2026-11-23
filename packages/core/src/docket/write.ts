import {
  docketCreateCardMethod,
  docketDeleteCardMethod,
  docketSaveBoardMethod,
  docketUpdateCardMethod,
  type Board,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import { toWireFace } from "./wire-face.ts"
import { bindDocketMoveCard } from "./move-fcp.ts"
import { rankAtColumnEnd } from "./move.ts"
import {
  currentBoardPayload,
  loadCurrentCard,
  publishCardChanged,
  type DocketWriteDeps,
} from "./write-helpers.ts"

export type { DocketWriteDeps } from "./write-helpers.ts"

export type DocketWriteBindings = Pick<
  MethodBindings,
  | "docket/create_card"
  | "docket/update_card"
  | "docket/move_card"
  | "docket/delete_card"
  | "docket/save_board"
>

export function createDocketWriteBindings(
  deps: DocketWriteDeps
): DocketWriteBindings {
  return {
    "docket/create_card": defineBinding(docketCreateCardMethod, (params) => {
      if (deps.store.readCard(params.id)) {
        throw engineError("invalid_params", `Card already exists: ${params.id}`)
      }
      const status = params.status ?? defaultStatus(deps.index.getBoard())
      const rank = rankAtColumnEnd(deps.index.listFaces(), status)
      const created = deps.store.nowIso()
      const written = deps.store.saveCard(
        params.id,
        {
          id: params.id,
          title: params.title,
          status,
          created,
          rank,
          refs: params.refs,
        },
        { body: params.body ?? "" }
      )
      if (!written.ok) {
        throw engineError("internal", "Failed to create card")
      }
      deps.index.refreshCard(params.id)
      publishCardChanged(deps, params.id)
      return { hash: written.hash, rank }
    }),
    "docket/update_card": defineBinding(docketUpdateCardMethod, (params) => {
      if (!deps.index.getCard(params.id)) {
        throw engineError("not_found", `Card not found: ${params.id}`)
      }
      const { body, ...frontmatter } = params.patch
      const written = deps.store.saveCard(params.id, frontmatter, {
        body: body ?? undefined,
        baseHash: params.baseHash,
      })
      if (!written.ok) {
        if (written.kind === "conflict") {
          throw engineError("conflict", "Stale baseHash", {
            current: loadCurrentCard(deps, params.id),
          })
        }
        throw engineError("internal", "Failed to update card")
      }
      deps.index.refreshCard(params.id)
      publishCardChanged(deps, params.id)
      return { hash: written.hash }
    }),
    "docket/move_card": bindDocketMoveCard(deps),
    "docket/delete_card": defineBinding(docketDeleteCardMethod, (params) => {
      if (!deps.index.getCard(params.id)) {
        throw engineError("not_found", `Card not found: ${params.id}`)
      }
      const removed = deps.store.deleteCard(params.id)
      if (!removed.ok) {
        throw engineError("not_found", `Card not found: ${params.id}`)
      }
      deps.index.refreshCard(params.id)
      deps.bus.publish("docket/update", {
        kind: "card_removed",
        cardId: params.id,
      })
      return {}
    }),
    "docket/save_board": defineBinding(docketSaveBoardMethod, (params) => {
      const current = deps.index.getBoard()
      const removedColumnIds = removedColumns(current, params.board)
      const affected = deps.index
        .listFaces()
        .filter((face) => removedColumnIds.includes(face.status))
      if (affected.length > 0 && !params.migrateStatus) {
        throw engineError(
          "invalid_params",
          "Removing columns with cards requires migrateStatus",
          { affectedCards: affected.map(toWireFace) }
        )
      }
      const migratedCardIds: string[] = []
      if (params.migrateStatus) {
        assertMigrateStatus(params.board, params.migrateStatus)
        for (const face of affected) {
          migrateCardStatus(deps, face.id, params.migrateStatus, face.hash)
          migratedCardIds.push(face.id)
        }
      }
      const written = deps.store.saveBoard(params.board, params.baseHash)
      if (!written.ok) {
        if (written.kind === "conflict") {
          throw engineError("conflict", "Stale baseHash", {
            current: currentBoardPayload(deps),
          })
        }
        throw engineError("internal", "Failed to save board")
      }
      deps.index.refreshBoard()
      const board = deps.index.getBoard()
      if (board) {
        deps.bus.publish("docket/update", {
          kind: "board_changed",
          hash: written.hash,
          board,
        })
      }
      return {
        hash: written.hash,
        migratedCardIds:
          migratedCardIds.length > 0 ? migratedCardIds : undefined,
      }
    }),
  }
}

function defaultStatus(board: Board | null): string {
  return board?.columns[0]?.id ?? "todo"
}

function removedColumns(current: Board | null, next: Board): string[] {
  const nextIds = new Set(next.columns.map((c) => c.id))
  return (current?.columns ?? [])
    .map((c) => c.id)
    .filter((id) => !nextIds.has(id))
}

function assertMigrateStatus(board: Board, migrateStatus: string): void {
  if (!board.columns.some((c) => c.id === migrateStatus)) {
    throw engineError(
      "invalid_params",
      `migrateStatus is not a column: ${migrateStatus}`
    )
  }
}

function migrateCardStatus(
  deps: DocketWriteDeps,
  cardId: string,
  status: string,
  baseHash: string
): void {
  const written = deps.store.saveCard(cardId, { status }, { baseHash })
  if (!written.ok) {
    throw engineError("conflict", "Card changed while migrating columns", {
      current: loadCurrentCard(deps, cardId),
    })
  }
  deps.index.refreshCard(cardId)
  publishCardChanged(deps, cardId)
}

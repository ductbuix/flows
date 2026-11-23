import {
  docketGetBoardMethod,
  docketGetCardMethod,
  docketListCardsMethod,
  splitCardMd,
  type WireCardFace,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { CardFace, DocketIndex } from "./index.ts"
import type { DocketStore } from "./store.ts"

const DEFAULT_LIST_LIMIT = 100

export type DocketReadDeps = {
  index: DocketIndex
  store: DocketStore
}

export type DocketReadBindings = Pick<
  MethodBindings,
  "docket/get_board" | "docket/list_cards" | "docket/get_card"
>

export function createDocketReadBindings(
  deps: DocketReadDeps
): DocketReadBindings {
  return {
    "docket/get_board": defineBinding(docketGetBoardMethod, () => {
      const boardFile = deps.store.readBoard()
      return {
        board: deps.index.getBoard() ?? boardFile?.data ?? null,
        hash: boardFile?.hash ?? "",
        warnings: boardFile?.warnings ?? [],
      }
    }),
    "docket/list_cards": defineBinding(docketListCardsMethod, (params) =>
      listCardFaces(deps.index.listFaces(), params.cursor, params.limit)
    ),
    "docket/get_card": defineBinding(docketGetCardMethod, (params) => {
      const entry = deps.index.getCard(params.id)
      if (!entry) {
        throw engineError("not_found", `Card not found: ${params.id}`)
      }
      const file = deps.store.readCard(params.id)
      const body = file ? (splitCardMd(file.text)?.body ?? "") : ""
      return {
        ...toWireFace(entry),
        body,
        fields: file?.data?.fields,
        assets: entry.assets,
        links: entry.links,
        backlinks: entry.backlinks,
      }
    }),
  }
}

function listCardFaces(
  faces: CardFace[],
  cursor?: string,
  limit = DEFAULT_LIST_LIMIT
): { items: WireCardFace[]; next?: string } {
  const sorted = [...faces].sort((a, b) => a.id.localeCompare(b.id))
  let start = 0
  if (cursor) {
    const at = sorted.findIndex((face) => face.id === cursor)
    start = at === -1 ? 0 : at + 1
  }
  const page = sorted.slice(start, start + limit).map(toWireFace)
  const hasMore = start + limit < sorted.length
  const next =
    hasMore && page.length > 0 ? page[page.length - 1]!.id : undefined
  return { items: page, next }
}

function toWireFace(face: CardFace): WireCardFace {
  return {
    id: face.id,
    path: face.path,
    hash: face.hash,
    title: face.title,
    status: face.status,
    columnId: face.columnId,
    rank: face.rank,
    start: face.start,
    due: face.due,
    done: face.done,
    refs: face.refs,
    linkCount: face.linkCount,
    assetCount: face.assetCount,
    missingLinkedAssetCount: face.missingLinkedAssetCount,
    warnings: face.warnings,
  }
}

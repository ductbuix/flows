import { splitCardMd } from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import type { DocketIndex } from "./index.ts"
import type { DocketStore } from "./store.ts"
import { toWireFace } from "./wire-face.ts"

export type DocketWriteDeps = {
  index: DocketIndex
  store: DocketStore
  bus: UpdateBus
}

export function publishCardChanged(
  deps: DocketWriteDeps,
  cardId: string
): void {
  const entry = deps.index.getCard(cardId)
  if (!entry) return
  deps.bus.publish("docket/update", {
    kind: "card_changed",
    card: toWireFace(entry),
  })
}

export function loadCurrentCard(deps: DocketWriteDeps, cardId: string) {
  const entry = deps.index.getCard(cardId)
  if (!entry) {
    throw engineError("not_found", `Card not found: ${cardId}`)
  }
  const file = deps.store.readCard(cardId)
  const body = file ? (splitCardMd(file.text)?.body ?? "") : ""
  return {
    ...toWireFace(entry),
    body,
    fields: file?.data?.fields,
    assets: entry.assets,
    links: entry.links,
    backlinks: entry.backlinks,
  }
}

export function currentBoardPayload(deps: DocketWriteDeps) {
  const boardFile = deps.store.readBoard()
  return {
    board: deps.index.getBoard() ?? boardFile?.data ?? null,
    hash: boardFile?.hash ?? "",
    warnings: boardFile?.warnings ?? [],
  }
}

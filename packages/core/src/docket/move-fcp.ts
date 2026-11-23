import { docketMoveCardMethod } from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import { defineBinding } from "../rpc/bind.ts"
import { computeMoveRank, doneForColumnMove } from "./move.ts"
import {
  loadCurrentCard,
  publishCardChanged,
  type DocketWriteDeps,
} from "./write-helpers.ts"

export function bindDocketMoveCard(deps: DocketWriteDeps) {
  return defineBinding(docketMoveCardMethod, (params) => {
    const entry = deps.index.getCard(params.id)
    if (!entry) {
      throw engineError("not_found", `Card not found: ${params.id}`)
    }
    if (params.beforeId === params.id) {
      throw engineError("invalid_params", "beforeId cannot be the moved card")
    }
    if (params.beforeId != null) {
      const anchor = deps.index.getCard(params.beforeId)
      if (!anchor) {
        throw engineError("not_found", `Card not found: ${params.beforeId}`)
      }
      if (anchor.status !== params.status) {
        throw engineError(
          "invalid_params",
          "beforeId is not in the target column"
        )
      }
    }
    const board = deps.index.getBoard()
    const rank = computeMoveRank(
      deps.index.listFaces(),
      params.id,
      params.status,
      params.beforeId
    )
    const patch: Record<string, unknown> = {
      status: params.status,
      rank,
    }
    const done = doneForColumnMove(
      board,
      entry.status,
      params.status,
      deps.store.nowIso()
    )
    if (done !== undefined) patch.done = done

    const written = deps.store.saveCard(params.id, patch, {
      baseHash: params.baseHash,
    })
    if (!written.ok) {
      if (written.kind === "conflict") {
        throw engineError("conflict", "Stale baseHash", {
          current: loadCurrentCard(deps, params.id),
        })
      }
      throw engineError("internal", "Failed to move card")
    }
    deps.index.refreshCard(params.id)
    publishCardChanged(deps, params.id)
    return { hash: written.hash, rank }
  })
}

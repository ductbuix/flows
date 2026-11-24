import type { DocketRef } from "@workspace/contracts"
import type { EventBus, RunFinishedEvent } from "../kernel/event-bus.ts"
import type { Disposable } from "../ports/file-watcher.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import type { DocketIndex } from "./index.ts"
import type { DocketStore } from "./store.ts"
import { publishCardChanged } from "./write-helpers.ts"

export const FLOWS_RUN_SYSTEM = "flows-run"

export type RunRefDeps = {
  store: DocketStore
  index: DocketIndex
  bus: UpdateBus
}

/** Label cached on the card: workflow id and terminal result (DES-038). */
export function flowsRunRefLabel(
  workflowId: string,
  status: RunFinishedEvent["status"]
): string {
  return `${workflowId} · ${status}`
}

/**
 * Listen for `run.finished` and upsert one `flows-run` ref per run on the
 * card (DES-038, DES-041, BL-159). No-op when the run has no card or the
 * card is missing.
 */
export function attachRunFinishedRef(
  events: EventBus,
  deps: RunRefDeps
): Disposable {
  return events.on("run.finished", (event) => {
    applyRunFinishedRef(deps, event)
  })
}

export function applyRunFinishedRef(
  deps: RunRefDeps,
  event: RunFinishedEvent
): void {
  if (!event.cardId) return
  const card = deps.store.readCard(event.cardId)
  if (!card?.data) return

  const label = flowsRunRefLabel(event.workflowId, event.status)
  const nextRef: DocketRef = {
    system: FLOWS_RUN_SYSTEM,
    id: event.runId,
    label,
  }
  const refs = upsertFlowsRunRef(card.data.refs ?? [], nextRef)
  const written = deps.store.saveCard(
    event.cardId,
    { refs },
    { baseHash: card.hash }
  )
  if (!written.ok) return
  deps.index.refreshCard(event.cardId)
  publishCardChanged(deps, event.cardId)
}

function upsertFlowsRunRef(
  refs: readonly DocketRef[],
  next: DocketRef
): DocketRef[] {
  const out = refs.map((r) => ({ ...r }))
  const i = out.findIndex(
    (r) => r.system === FLOWS_RUN_SYSTEM && r.id === next.id
  )
  if (i >= 0) {
    out[i] = { ...out[i], ...next }
    return out
  }
  out.push(next)
  return out
}

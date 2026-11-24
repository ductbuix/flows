import {
  inboxApprovalOptionIdSchema,
  inboxPermissionOptionIdSchema,
  type WireInboxItem,
} from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { engineError } from "../kernel/engine-error.ts"
import type { EventStore, StoredEvent } from "../ports/event-store.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import {
  emptyInboxProjection,
  foldInboxStored,
  openInboxItems,
  type InboxDecision,
  type InboxItem,
  type InboxProjectionState,
} from "./projection.ts"

export type InboxAnswerPush = (input: {
  runId: string
  at: string
  nodeId: string
  pass: number
  /** Approval or permission option id. */
  optionId: InboxDecision
  /** Set for permission items (DES-041). */
  requestId?: string
  kind: InboxItem["kind"]
}) => Promise<void>

export type InboxServiceDeps = {
  bus: UpdateBus
  clock: Clock
  /** Route an answer to the owning run actor (DES-041). */
  pushAnswer: InboxAnswerPush
  /**
   * When set, `answer`/`dismiss` re-read the run log after the push and
   * apply new events so the projection stays in sync.
   */
  events?: EventStore
}

export function createInboxService(deps: InboxServiceDeps): InboxService {
  return new InboxService(deps)
}

export class InboxService {
  private state: InboxProjectionState = emptyInboxProjection()
  private readonly applied = new Set<number>()
  private live = true

  constructor(private readonly deps: InboxServiceDeps) {}

  /** Apply one stored event; publishes `inbox/update` while live. */
  apply(stored: StoredEvent): void {
    if (this.applied.has(stored.seq)) return
    this.applied.add(stored.seq)
    const folded = foldInboxStored(this.state, stored)
    this.state = folded.state
    if (!this.live) return
    for (const change of folded.changes) {
      if (change.kind === "item_added") {
        this.deps.bus.publish("inbox/update", {
          kind: "item_added",
          item: change.item,
        })
      } else {
        this.deps.bus.publish("inbox/update", {
          kind: "item_resolved",
          itemId: change.itemId,
          ...(change.decision ? { decision: change.decision } : {}),
        })
      }
    }
  }

  /** Silent rebuild from events; same open items as a live fold. */
  rebuild(events: readonly StoredEvent[]): void {
    this.live = false
    this.state = emptyInboxProjection()
    this.applied.clear()
    for (const stored of events) {
      this.apply(stored)
    }
    this.live = true
  }

  list(params: { cursor?: string; limit?: number }): {
    items: WireInboxItem[]
    next?: string
  } {
    const all = openInboxItems(this.state)
    let start = 0
    if (params.cursor !== undefined) {
      const idx = all.findIndex((item) => item.id === params.cursor)
      start = idx === -1 ? all.length : idx + 1
    }
    const size = params.limit ?? all.length
    const page = all.slice(start, start + size)
    const last = page[page.length - 1]
    const more = start + page.length < all.length
    return {
      items: page,
      ...(more && last ? { next: last.id } : {}),
    }
  }

  get(itemId: string): InboxItem | undefined {
    return this.state.items.get(itemId)
  }

  openItems(): InboxItem[] {
    return openInboxItems(this.state)
  }

  async answer(itemId: string, optionId: string): Promise<void> {
    const item = this.requireOpen(itemId)
    if (item.kind === "approval") {
      const parsed = inboxApprovalOptionIdSchema.safeParse(optionId)
      if (!parsed.success) {
        throw engineError(
          "invalid_params",
          `Unknown optionId for approval: ${optionId}`
        )
      }
      await this.route(item, parsed.data)
      return
    }
    const parsed = inboxPermissionOptionIdSchema.safeParse(optionId)
    if (!parsed.success) {
      throw engineError(
        "invalid_params",
        `Unknown optionId for permission: ${optionId}`
      )
    }
    await this.route(item, parsed.data)
  }

  /** Dismiss rejects so the run does not stay parked. */
  async dismiss(itemId: string): Promise<void> {
    const item = this.requireOpen(itemId)
    if (item.kind === "approval") {
      await this.route(item, "rejected")
      return
    }
    await this.route(item, "reject-once")
  }

  private requireOpen(itemId: string): InboxItem {
    const item = this.state.items.get(itemId)
    if (!item || item.status !== "open") {
      throw engineError("not_found", `Inbox item not found: ${itemId}`)
    }
    return item
  }

  private async route(item: InboxItem, optionId: InboxDecision): Promise<void> {
    const at = new Date(this.deps.clock.now()).toISOString()
    await this.deps.pushAnswer({
      runId: item.runId,
      at,
      nodeId: item.nodeId,
      pass: item.pass,
      kind: item.kind,
      optionId,
      ...(item.kind === "permission" ? { requestId: item.requestId } : {}),
    })
    this.syncRun(item.runId)
  }

  private syncRun(runId: string): void {
    const store = this.deps.events
    if (!store) return
    for (const stored of store.read(runId)) {
      this.apply(stored)
    }
  }
}

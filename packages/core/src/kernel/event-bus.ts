import type { Disposable } from "../ports/file-watcher.ts"

/** Payload when a run reaches a terminal status (DES-039, DES-041). */
export type RunFinishedEvent = {
  runId: string
  workflowId: string
  status: "succeeded" | "failed" | "cancelled"
  /** Card the run was started from; omitted for ad-hoc runs. */
  cardId?: string
}

export type DomainEventMap = {
  "run.finished": RunFinishedEvent
}

type Handler<K extends keyof DomainEventMap> = (
  payload: DomainEventMap[K]
) => void

/**
 * In-process domain event bus between bounded contexts (DES-039, DES-042).
 * Not the FCP UpdateBus.
 */
export class EventBus {
  private readonly handlers = new Map<
    keyof DomainEventMap,
    Set<(payload: never) => void>
  >()

  on<K extends keyof DomainEventMap>(type: K, handler: Handler<K>): Disposable {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    const fn = handler as (payload: never) => void
    set.add(fn)
    return {
      dispose: () => {
        set!.delete(fn)
        if (set!.size === 0) this.handlers.delete(type)
      },
    }
  }

  emit<K extends keyof DomainEventMap>(
    type: K,
    payload: DomainEventMap[K]
  ): void {
    const set = this.handlers.get(type)
    if (!set) return
    for (const handler of [...set]) {
      ;(handler as Handler<K>)(payload)
    }
  }
}

export function createEventBus(): EventBus {
  return new EventBus()
}

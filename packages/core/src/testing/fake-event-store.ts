import type { EngineEvent } from "@workspace/contracts"
import type {
  EventAppendOptions,
  EventAppendResult,
  EventStore,
  StoredEvent,
} from "../ports/event-store.ts"

export function createFakeEventStore(): EventStore {
  return new FakeEventStore()
}

class FakeEventStore implements EventStore {
  private nextSeq = 1
  private readonly byRun = new Map<string, StoredEvent[]>()

  append(
    runId: string,
    events: readonly EngineEvent[],
    options: EventAppendOptions
  ): EventAppendResult {
    const current = this.lastSeq(runId)
    if (current !== options.expectSeq) {
      return { ok: false, kind: "conflict", lastSeq: current }
    }
    if (events.length === 0) {
      return { ok: true, lastSeq: current, appended: [] }
    }
    const appended: StoredEvent[] = []
    const list = this.byRun.get(runId) ?? []
    for (const event of events) {
      if (event.runId !== runId) {
        throw new Error(`event runId ${event.runId} !== ${runId}`)
      }
      const stored: StoredEvent = { seq: this.nextSeq++, event }
      list.push(stored)
      appended.push(stored)
    }
    this.byRun.set(runId, list)
    return {
      ok: true,
      lastSeq: appended[appended.length - 1]!.seq,
      appended,
    }
  }

  read(runId: string, fromSeq = 0): StoredEvent[] {
    const list = this.byRun.get(runId) ?? []
    return list.filter((s) => s.seq >= fromSeq)
  }

  tail(): number {
    return this.nextSeq - 1
  }

  private lastSeq(runId: string): number {
    const list = this.byRun.get(runId)
    if (!list || list.length === 0) return 0
    return list[list.length - 1]!.seq
  }
}

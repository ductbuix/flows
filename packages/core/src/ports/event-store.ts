import type { EngineEvent } from "@workspace/contracts"

export type StoredEvent = {
  seq: number
  event: EngineEvent
}

export type EventAppendOptions = { expectSeq: number }

export type EventAppendResult =
  | { ok: true; lastSeq: number; appended: StoredEvent[] }
  | { ok: false; kind: "conflict"; lastSeq: number }

/**
 * Append-only run event log with optimistic concurrency (DES-041).
 * `expectSeq` is the last seq for that run (0 when empty).
 */
export interface EventStore {
  append(
    runId: string,
    events: readonly EngineEvent[],
    options: EventAppendOptions
  ): EventAppendResult
  /** Events for `runId` with seq >= `fromSeq` (default 0). */
  read(runId: string, fromSeq?: number): StoredEvent[]
  /** Global high-water mark; 0 when the log is empty. */
  tail(): number
}

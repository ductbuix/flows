import { beforeEach, describe, expect, it } from "vitest"
import type { EngineEvent } from "@workspace/contracts"
import type { EventStore } from "../ports/event-store.ts"

export type EventStoreFactory = () => EventStore

function evt(
  runId: string,
  type: "run_cancelled" | "run_deleted"
): EngineEvent {
  return { type, runId, at: "2026-01-01T00:00:00.000Z" }
}

export function describeEventStoreContract(
  title: string,
  factories: ReadonlyArray<readonly [string, EventStoreFactory]>
): void {
  describe.each(factories)(`${title} (%s)`, (_label, createStore) => {
    let store: EventStore

    beforeEach(() => {
      store = createStore()
    })

    it("tail is 0 on an empty store", () => {
      expect(store.tail()).toBe(0)
      expect(store.read("r1")).toEqual([])
    })

    it("append then read round-trips events", () => {
      const a = evt("r1", "run_cancelled")
      const r = store.append("r1", [a], { expectSeq: 0 })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.lastSeq).toBe(1)
      expect(r.appended).toEqual([{ seq: 1, event: a }])
      expect(store.read("r1")).toEqual([{ seq: 1, event: a }])
      expect(store.tail()).toBe(1)
    })

    it("append with stale expectSeq returns conflict", () => {
      store.append("r1", [evt("r1", "run_cancelled")], { expectSeq: 0 })
      const r = store.append("r1", [evt("r1", "run_deleted")], {
        expectSeq: 0,
      })
      expect(r).toEqual({ ok: false, kind: "conflict", lastSeq: 1 })
      expect(store.read("r1")).toHaveLength(1)
    })

    it("append with matching expectSeq succeeds", () => {
      store.append("r1", [evt("r1", "run_cancelled")], { expectSeq: 0 })
      const b = evt("r1", "run_deleted")
      const r = store.append("r1", [b], { expectSeq: 1 })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.lastSeq).toBe(2)
      expect(store.read("r1").map((s) => s.event.type)).toEqual([
        "run_cancelled",
        "run_deleted",
      ])
    })

    it("batch append assigns consecutive seqs", () => {
      const events = [evt("r1", "run_cancelled"), evt("r1", "run_deleted")]
      const r = store.append("r1", events, { expectSeq: 0 })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.appended.map((s) => s.seq)).toEqual([1, 2])
      expect(store.tail()).toBe(2)
    })

    it("read fromSeq filters by seq", () => {
      store.append(
        "r1",
        [evt("r1", "run_cancelled"), evt("r1", "run_deleted")],
        { expectSeq: 0 }
      )
      expect(store.read("r1", 2).map((s) => s.seq)).toEqual([2])
      expect(store.read("r1", 3)).toEqual([])
    })

    it("isolates runs and shares a global seq", () => {
      store.append("a", [evt("a", "run_cancelled")], { expectSeq: 0 })
      store.append("b", [evt("b", "run_cancelled")], { expectSeq: 0 })
      expect(store.read("a").map((s) => s.seq)).toEqual([1])
      expect(store.read("b").map((s) => s.seq)).toEqual([2])
      expect(store.tail()).toBe(2)
    })
  })
}

import {
  createInboxBindings,
  createInboxService,
  engineError,
  type Clock,
  type EventStore,
  type InboxBindings,
  type UpdateBus,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"

const systemClock: Clock = { now: () => Date.now() }

export type InboxFcp = {
  bindings: InboxBindings
  dispose: () => void
}

/** Live inbox projection over the engine event log (BL-145 / BL-178). */
export function createInboxFcp(engine: Engine, bus: UpdateBus): InboxFcp {
  const events: EventStore = {
    append() {
      return { ok: false, kind: "conflict", lastSeq: 0 }
    },
    read(runId, fromSeq = 0) {
      return engine
        .eventsWithSeq(runId)
        .filter((stored) => stored.seq >= fromSeq)
    },
    tail() {
      let max = 0
      for (const run of engine.listRuns()) {
        for (const stored of engine.eventsWithSeq(run.runId)) {
          if (stored.seq > max) max = stored.seq
        }
      }
      return max
    },
  }

  const inbox = createInboxService({
    bus,
    clock: systemClock,
    events,
    pushAnswer: async (input) => {
      if (input.kind !== "approval") {
        throw engineError(
          "failed_precondition",
          "Permission inbox answers are not wired on the daemon yet"
        )
      }
      if (input.optionId === "approved") {
        engine.approveTask(input.runId, input.nodeId)
        return
      }
      engine.rejectTask(input.runId, input.nodeId)
    },
  })

  const seeded = engine
    .listRuns()
    .flatMap((run) => engine.eventsWithSeq(run.runId))
    .sort((a, b) => a.seq - b.seq)
  inbox.rebuild(seeded)

  const unsub = engine.onEvent((stored) => inbox.apply(stored))
  return {
    bindings: createInboxBindings(inbox),
    dispose: () => unsub(),
  }
}

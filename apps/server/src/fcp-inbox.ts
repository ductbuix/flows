import {
  createInboxBindings,
  createInboxService,
  engineError,
  type Clock,
  type EventStore,
  type InboxBindings,
  type InboxService,
  type UpdateBus,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"
import type { CoreRunHost } from "./core-run-host.ts"

const systemClock: Clock = { now: () => Date.now() }

export type InboxFcp = {
  inbox: InboxService
  bindings: InboxBindings
  dispose: () => void
}

/** Live inbox projection over the engine event log (BL-145 / BL-178 / BL-192). */
export function createInboxFcp(
  engine: Engine,
  bus: UpdateBus,
  coreRuns?: CoreRunHost
): InboxFcp {
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
      if (input.kind === "approval") {
        const decision = input.optionId === "approved" ? "approved" : "rejected"
        if (
          coreRuns &&
          (await coreRuns.answerApproval({
            runId: input.runId,
            nodeId: input.nodeId,
            decision,
          }))
        ) {
          return
        }
        if (decision === "approved") {
          engine.approveTask(input.runId, input.nodeId)
          return
        }
        engine.rejectTask(input.runId, input.nodeId)
        return
      }
      if (!input.requestId) {
        throw engineError(
          "failed_precondition",
          "ACP inbox answer is missing requestId"
        )
      }
      const ask = {
        kind: input.kind,
        runId: input.runId,
        at: input.at,
        nodeId: input.nodeId,
        pass: input.pass,
        requestId: input.requestId,
        optionId: input.optionId,
        ...(input.answers ? { answers: input.answers } : {}),
      }
      if (coreRuns?.answerAcpAsk(ask)) return
      if (engine.answerAcpAsk(ask)) return
      throw engineError(
        "failed_precondition",
        "No live ACP session for this inbox item"
      )
    },
  })

  const seeded = engine
    .listRuns()
    .flatMap((run) => engine.eventsWithSeq(run.runId))
    .sort((a, b) => a.seq - b.seq)
  inbox.rebuild(seeded)

  const unsub = engine.onEvent((stored) => inbox.apply(stored))
  return {
    inbox,
    bindings: createInboxBindings(inbox),
    dispose: () => unsub(),
  }
}

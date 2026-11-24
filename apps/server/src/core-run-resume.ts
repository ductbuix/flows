import type { Workflow } from "@workspace/contracts"
import { fold, type RunActor } from "@workspace/core"
import type { Engine } from "@workspace/engine"
import { isCoreRunEligible } from "./core-run-eligible.ts"
import type { CoreRunSession } from "./core-run-session.ts"

export type ResumeDeps = {
  engine: Engine
  session: CoreRunSession
  makeActor: (runId: string) => RunActor
  activate: (runId: string) => Promise<void>
}

/** Replay running/queued core-eligible runs from the shared event log. */
export async function resumeCoreRuns(deps: ResumeDeps): Promise<void> {
  const { engine, session, makeActor, activate } = deps
  type Entry = {
    runId: string
    at: string
    status: string
    graph: Workflow
    workflowId: string
  }
  const pending: Entry[] = []

  for (const summary of engine.listRuns()) {
    const stored = engine.eventStore().read(summary.runId)
    let state = null as ReturnType<typeof fold>
    for (const s of stored) state = fold(state, s.event)
    if (!state || state.deleted) continue
    if (state.status !== "running" && state.status !== "queued") continue
    if (!isCoreRunEligible(state.graph)) continue
    session.trackCap(state.graph)
    pending.push({
      runId: summary.runId,
      at: state.startedAt ?? "1970-01-01T00:00:00.000Z",
      status: state.status,
      graph: state.graph,
      workflowId: state.workflowId,
    })
  }

  pending.sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : a.runId.localeCompare(b.runId)
  )

  for (const r of pending) {
    const slot = session.scheduler.admit(r.runId, r.workflowId, r.at)
    const actor = makeActor(r.runId)
    session.attachLive(r.runId, r.workflowId, actor)
    await actor.recover()
    if (r.status === "queued" && slot === "running") {
      await activate(r.runId)
    } else if (r.status === "running") {
      await actor.push({ kind: "wake", at: new Date().toISOString() })
      session.endIfTerminal(r.runId, actor)
    }
  }
}

import type { Workflow } from "@workspace/contracts"
import { createScheduler, RunActor, type Scheduler } from "@workspace/core"

export type LiveRun = {
  actor: RunActor
  workflowId: string
}

/** Per-host live-run table, scheduler and abort controllers. */
export type CoreRunSession = {
  scheduler: Scheduler
  live: Map<string, LiveRun>
  aborts: Map<string, AbortController>
  trackCap(graph: Workflow): void
  attachLive(runId: string, workflowId: string, actor: RunActor): void
  endLive(runId: string): void
  endIfTerminal(runId: string, actor: RunActor): void
  promoteQueued(endedRunId: string): void
  onActivated: (runId: string) => void
}

export function createCoreRunSession(): CoreRunSession {
  const caps = new Map<string, number>()
  const scheduler = createScheduler({
    maxConcurrent: 32,
    maxConcurrentRuns: (workflowId) => caps.get(workflowId) ?? 1,
  })
  const live = new Map<string, LiveRun>()
  const aborts = new Map<string, AbortController>()

  const session: CoreRunSession = {
    scheduler,
    live,
    aborts,
    onActivated: () => undefined,

    trackCap(graph) {
      caps.set(graph.id, graph.limits?.maxConcurrentRuns ?? 1)
    },

    attachLive(runId, workflowId, actor) {
      aborts.set(runId, new AbortController())
      live.set(runId, { actor, workflowId })
    },

    endLive(runId) {
      if (!live.has(runId)) return
      live.delete(runId)
      aborts.delete(runId)
      session.promoteQueued(runId)
    },

    endIfTerminal(runId, actor) {
      const status = actor.getState()?.status
      if (
        status === "succeeded" ||
        status === "failed" ||
        status === "cancelled"
      ) {
        session.endLive(runId)
      }
    },

    promoteQueued(endedRunId) {
      const before = new Set(scheduler.activeRuns().map((r) => r.runId))
      before.delete(endedRunId)
      scheduler.endRun(endedRunId)
      for (const r of scheduler.activeRuns()) {
        if (!before.has(r.runId)) session.onActivated(r.runId)
      }
    },
  }
  return session
}

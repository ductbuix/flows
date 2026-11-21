import type { EngineEvent, WorkflowLimits } from "@workspace/shared"
import type { EventLog } from "./event-log.ts"
import type { RunState } from "./fold.ts"
import type { ResolveHost } from "./resolve.ts"
import type { RetryQueue } from "./retry-queue.ts"
import type { SpawnHost } from "./spawn.ts"

export type SchedulerCore = {
  runId: string
  runRoot: string
  workflowRoot: string
  watching: Set<string>
  retries: RetryQueue
  judgeCache: Map<string, Promise<boolean>>
  globalLimits?: WorkflowLimits
  state: () => RunState
  append: (event: EngineEvent) => void
  requestTick: () => void
  launchAgain: (taskId: string) => void | Promise<void>
  finish: (state: RunState) => void
}

export function cancelHost(core: SchedulerCore) {
  return {
    runId: core.runId,
    state: core.state,
    append: core.append,
    finish: core.finish,
  }
}

export function watchHost(core: SchedulerCore) {
  return {
    runId: core.runId,
    runRoot: core.runRoot,
    watching: core.watching,
    state: core.state,
    append: core.append,
    requestTick: core.requestTick,
  }
}

export function launchHost(core: SchedulerCore) {
  return {
    runId: core.runId,
    runRoot: core.runRoot,
    workflowRoot: core.workflowRoot,
    graph: core.state().graph,
    state: core.state,
    append: core.append,
    watchHost: () => watchHost(core),
    globalLimits: core.globalLimits,
  }
}

export function resolveHost(core: SchedulerCore): ResolveHost {
  return {
    runId: core.runId,
    runRoot: core.runRoot,
    workflowRoot: core.workflowRoot,
    state: core.state,
    append: core.append,
    judgeCache: core.judgeCache,
    scheduleRetry: (taskId, backoffMs) => {
      core.retries.schedule(taskId, backoffMs, () => {
        if (core.state().status !== "running" || core.state().cancelRequested) {
          return
        }
        void Promise.resolve(core.launchAgain(taskId)).then(() =>
          core.requestTick()
        )
      })
    },
    launchAgain: core.launchAgain,
  }
}

export function spawnHost(core: SchedulerCore): SpawnHost {
  return {
    runId: core.runId,
    runRoot: core.runRoot,
    state: core.state,
    append: core.append,
    globalLimits: core.globalLimits,
    scheduleRetry: (taskId, backoffMs) => {
      core.retries.schedule(taskId, backoffMs, () => {
        if (core.state().status !== "running" || core.state().cancelRequested) {
          return
        }
        void Promise.resolve(core.launchAgain(taskId)).then(() =>
          core.requestTick()
        )
      })
    },
  }
}

export type { EventLog }

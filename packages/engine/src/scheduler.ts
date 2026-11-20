import type { EngineEvent, WorkflowLimits } from "@workspace/shared"
import { cancelRun, finishCancel } from "./cancel.ts"
import type { EventLog } from "./event-log.ts"
import {
  approvedAwaitingIds,
  foldEvents,
  readyTaskIds,
  type RunState,
} from "./fold.ts"
import { launchReadyTasks, launchTaskAttempt } from "./launch.ts"
import { resumeOpenAttempts } from "./resume.ts"
import {
  resolveLoops,
  resolveSkips,
  runHasHardFailure,
  shouldSettleRun,
} from "./resolve.ts"
import { RetryQueue } from "./retry-queue.ts"
import {
  cancelHost,
  launchHost,
  resolveHost,
  spawnHost,
  watchHost,
  type SchedulerCore,
} from "./scheduler-hosts.ts"
import { resolveSpawn } from "./spawn.ts"

function now(): string {
  return new Date().toISOString()
}

export type SchedulerOptions = {
  log: EventLog
  runId: string
  workflowRoot: string
  runRoot: string
  globalLimits?: WorkflowLimits
}

/** One run: ready, skip, approval, launch, retry/repeat, spawn, cancel. */
export class Scheduler {
  private readonly log: EventLog
  private readonly runId: string
  private readonly workflowRoot: string
  private readonly runRoot: string
  private readonly globalLimits?: WorkflowLimits
  private ticking = false
  private again = false
  private readonly waiters: Array<(state: RunState) => void> = []
  private settled = false
  private readonly watching = new Set<string>()
  private readonly retries = new RetryQueue()
  private readonly judgeCache = new Map<string, Promise<boolean>>()

  constructor(options: SchedulerOptions) {
    this.log = options.log
    this.runId = options.runId
    this.workflowRoot = options.workflowRoot
    this.runRoot = options.runRoot
    this.globalLimits = options.globalLimits
  }

  state(): RunState {
    const events = this.log.listByRun(this.runId).map((e) => e.event)
    const state = foldEvents(events)
    if (!state) throw new Error(`no events for run ${this.runId}`)
    return state
  }

  wait(): Promise<RunState> {
    const current = this.state()
    if (current.status !== "running") return Promise.resolve(current)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  requestTick(): void {
    if (this.ticking) {
      this.again = true
      return
    }
    void this.runTicks()
  }

  resumeOpenAttempts(): void {
    resumeOpenAttempts(watchHost(this.core()), (event) => this.append(event))
  }

  resumeCancelIfNeeded(): void {
    const state = this.state()
    if (state.status === "running" && state.cancelRequested) {
      finishCancel(cancelHost(this.core()))
    }
  }

  approve(taskId: string): void {
    this.requireAwaiting(taskId)
    if (this.state().tasks[taskId]?.approved) return
    this.append({
      type: "task_approved",
      runId: this.runId,
      taskId,
      at: now(),
    })
    this.requestTick()
  }

  reject(taskId: string): void {
    this.requireAwaiting(taskId)
    this.append({
      type: "task_rejected",
      runId: this.runId,
      taskId,
      reason: "rejected",
      at: now(),
    })
    this.requestTick()
  }

  cancel(): void {
    this.retries.clear()
    cancelRun(cancelHost(this.core()))
  }

  private requireAwaiting(taskId: string): void {
    const task = this.state().tasks[taskId]
    if (!task || task.status !== "awaiting_approval") {
      throw new Error(`task ${taskId} is not awaiting approval`)
    }
  }

  private core(): SchedulerCore {
    return {
      runId: this.runId,
      runRoot: this.runRoot,
      workflowRoot: this.workflowRoot,
      watching: this.watching,
      retries: this.retries,
      judgeCache: this.judgeCache,
      globalLimits: this.globalLimits,
      state: () => this.state(),
      append: (event) => this.append(event),
      requestTick: () => this.requestTick(),
      launchAgain: (taskId) => this.launchAgain(taskId),
      finish: (state) => this.finish(state),
    }
  }

  private launchAgain(taskId: string): void {
    launchTaskAttempt(launchHost(this.core()), taskId, ["running"])
  }

  private async runTicks(): Promise<void> {
    this.ticking = true
    try {
      do {
        this.again = false
        await this.tickOnce()
      } while (this.again)
    } finally {
      this.ticking = false
    }
  }

  private append(event: EngineEvent): void {
    this.log.append(event)
  }

  private async tickOnce(): Promise<void> {
    if (this.settled) return
    const state = this.state()
    if (state.status !== "running" || state.cancelRequested) {
      if (state.cancelRequested && state.status === "running") {
        finishCancel(cancelHost(this.core()))
      } else {
        this.finish(state)
      }
      return
    }
    const host = resolveHost(this.core())
    await resolveLoops(host)
    resolveSpawn(spawnHost(this.core()))
    await resolveSkips(host)
    launchReadyTasks(launchHost(this.core()))
    this.maybeSettle()
  }

  private maybeSettle(): void {
    const after = this.state()
    if (after.status !== "running") {
      this.finish(after)
      return
    }
    const waiting = Object.values(after.tasks).some(
      (t) => t.status === "awaiting_approval" && !t.approved
    )
    if (
      !shouldSettleRun(
        after,
        readyTaskIds(after).length,
        approvedAwaitingIds(after).length,
        waiting,
        this.retries.size
      )
    )
      return
    this.append({
      type: runHasHardFailure(after) ? "run_failed" : "run_succeeded",
      runId: this.runId,
      at: now(),
    })
    this.finish(this.state())
  }

  private finish(state: RunState): void {
    if (this.settled) return
    this.settled = true
    this.retries.clear()
    for (const resolve of this.waiters.splice(0)) resolve(state)
  }
}

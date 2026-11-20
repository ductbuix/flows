import type { EngineEvent, Workflow } from "@workspace/shared"
import { cancelRun, finishCancel } from "./cancel.ts"
import type { EventLog } from "./event-log.ts"
import {
  approvedAwaitingIds,
  foldEvents,
  hasOpenAttempts,
  readyTaskIds,
  type RunState,
} from "./fold.ts"
import { launchReadyTasks } from "./launch.ts"
import { resumeOpenAttempts } from "./resume.ts"

function now(): string {
  return new Date().toISOString()
}

export type SchedulerOptions = {
  log: EventLog
  runId: string
  workflowRoot: string
  runRoot: string
  graph: Workflow
}

/**
 * Drives one run: ready tasks from needs, approval gates, launch command
 * processes, cancel. Resume re-attaches or interrupts (DES-003).
 */
export class Scheduler {
  private readonly log: EventLog
  private readonly runId: string
  private readonly workflowRoot: string
  private readonly runRoot: string
  private readonly graph: Workflow
  private ticking = false
  private again = false
  private readonly waiters: Array<(state: RunState) => void> = []
  private settled = false
  private readonly watching = new Set<string>()

  constructor(options: SchedulerOptions) {
    this.log = options.log
    this.runId = options.runId
    this.workflowRoot = options.workflowRoot
    this.runRoot = options.runRoot
    this.graph = options.graph
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
    return new Promise((resolve) => {
      this.waiters.push(resolve)
    })
  }

  requestTick(): void {
    if (this.ticking) {
      this.again = true
      return
    }
    void this.runTicks()
  }

  /** Re-attach live pids or interrupt open attempts, then tick. */
  resumeOpenAttempts(): void {
    resumeOpenAttempts(this.watchHost(), (event) => this.append(event))
  }

  /** Finish cancel if cancel_requested was logged without run_cancelled. */
  resumeCancelIfNeeded(): void {
    const state = this.state()
    if (state.status !== "running" || !state.cancelRequested) return
    finishCancel(this.cancelHost())
  }

  approve(taskId: string): void {
    const state = this.state()
    const task = state.tasks[taskId]
    if (!task || task.status !== "awaiting_approval") {
      throw new Error(`task ${taskId} is not awaiting approval`)
    }
    if (task.approved) return
    this.append({
      type: "task_approved",
      runId: this.runId,
      taskId,
      at: now(),
    })
    this.requestTick()
  }

  reject(taskId: string): void {
    const state = this.state()
    const task = state.tasks[taskId]
    if (!task || task.status !== "awaiting_approval") {
      throw new Error(`task ${taskId} is not awaiting approval`)
    }
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
    cancelRun(this.cancelHost())
  }

  private cancelHost() {
    return {
      runId: this.runId,
      state: () => this.state(),
      append: (event: EngineEvent) => this.append(event),
      finish: (state: RunState) => this.finish(state),
    }
  }

  private watchHost() {
    return {
      runId: this.runId,
      runRoot: this.runRoot,
      watching: this.watching,
      state: () => this.state(),
      append: (event: EngineEvent) => this.append(event),
      requestTick: () => this.requestTick(),
    }
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
        finishCancel(this.cancelHost())
      } else {
        this.finish(state)
      }
      return
    }

    launchReadyTasks({
      runId: this.runId,
      runRoot: this.runRoot,
      workflowRoot: this.workflowRoot,
      graph: this.graph,
      state: () => this.state(),
      append: (event) => this.append(event),
      watchHost: () => this.watchHost(),
    })

    const after = this.state()
    if (after.status !== "running") {
      this.finish(after)
      return
    }

    const waiting = Object.values(after.tasks).some(
      (t) => t.status === "awaiting_approval" && !t.approved
    )
    if (
      !hasOpenAttempts(after) &&
      readyTaskIds(after).length === 0 &&
      approvedAwaitingIds(after).length === 0 &&
      !waiting
    ) {
      const failed = Object.values(after.tasks).some(
        (t) => t.status === "failed"
      )
      this.append({
        type: failed ? "run_failed" : "run_succeeded",
        runId: this.runId,
        at: now(),
      })
      this.finish(this.state())
    }
  }

  private finish(state: RunState): void {
    if (this.settled) return
    this.settled = true
    for (const resolve of this.waiters.splice(0)) {
      resolve(state)
    }
  }
}

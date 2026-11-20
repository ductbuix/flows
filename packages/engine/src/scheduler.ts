import type { EngineEvent, Workflow } from "@workspace/shared"
import type { EventLog } from "./event-log.ts"
import { prepareAttemptDirs } from "./dirs.ts"
import {
  foldEvents,
  hasOpenAttempts,
  readyTaskIds,
  type RunState,
} from "./fold.ts"
import { launchCommand, waitForExit } from "./runner.ts"

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
 * Drives one run: ready tasks from needs, launch command processes in
 * parallel, append-then-act for every side effect.
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

  constructor(options: SchedulerOptions) {
    this.log = options.log
    this.runId = options.runId
    this.workflowRoot = options.workflowRoot
    this.runRoot = options.runRoot
    this.graph = options.graph
  }

  /** Current fold of this run's events. */
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

  /** Queue a tick; coalesces concurrent calls. */
  requestTick(): void {
    if (this.ticking) {
      this.again = true
      return
    }
    void this.runTicks()
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
    if (state.status !== "running") {
      this.finish(state)
      return
    }

    const ready = readyTaskIds(state)
    const byId = new Map(this.graph.tasks.map((t) => [t.id, t]))

    for (const taskId of ready) {
      const task = byId.get(taskId)
      if (!task || task.kind !== "command") continue

      const attempt = (state.tasks[taskId]?.attempts.length ?? 0) + 1
      const at = now()

      // Append, then act (DES-003).
      this.append({
        type: "attempt_started",
        runId: this.runId,
        taskId,
        attempt,
        at,
      })
      prepareAttemptDirs(this.runRoot, taskId, attempt)

      const { child, pid } = launchCommand(
        task,
        attempt,
        {
          workflowRoot: this.workflowRoot,
          runRoot: this.runRoot,
          runId: this.runId,
        },
        this.graph
      )

      this.append({
        type: "attempt_launched",
        runId: this.runId,
        taskId,
        attempt,
        pid,
        at: now(),
      })

      void waitForExit(child)
        .then((exitCode) => {
          this.append({
            type: "attempt_finished",
            runId: this.runId,
            taskId,
            attempt,
            exitCode,
            at: now(),
          })
          this.requestTick()
        })
        .catch(() => {
          this.append({
            type: "attempt_finished",
            runId: this.runId,
            taskId,
            attempt,
            exitCode: 1,
            at: now(),
          })
          this.requestTick()
        })
    }

    const after = this.state()
    if (after.status !== "running") {
      this.finish(after)
      return
    }

    if (!hasOpenAttempts(after) && readyTaskIds(after).length === 0) {
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

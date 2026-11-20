import { randomUUID } from "node:crypto"
import type { EngineEvent, Workflow } from "@workspace/shared"
import { prepareRunDirs } from "./dirs.ts"
import { deleteRunFiles, finishRunRemoval } from "./delete-run.ts"
import { EventLog } from "./event-log.ts"
import { foldEvents, type RunState } from "./fold.ts"
import { appDbPath, resolveAppHome, runDir, workflowDir } from "./paths.ts"
import { Scheduler } from "./scheduler.ts"
import { assertValidGraph, loadWorkflowFile } from "./workflow.ts"

export type CreateEngineOptions = {
  /** App home directory. Defaults to FLOWAPP_HOME or ~/.flowapp. */
  home?: string
}

export type StartRunOptions = {
  /** Absolute path to the workflow directory (contains workflow.yaml). */
  workflowDir: string
  /** Optional run id; random UUID if omitted. */
  runId?: string
}

export type RunHandle = {
  runId: string
  wait: () => Promise<RunState>
  state: () => RunState
}

export class Engine {
  readonly home: string
  private readonly log: EventLog
  private readonly schedulers = new Map<string, Scheduler>()

  constructor(options: CreateEngineOptions = {}) {
    this.home = resolveAppHome(options.home)
    this.log = new EventLog(appDbPath(this.home))
  }

  loadWorkflow(workflowDirPath: string): Workflow {
    const workflow = loadWorkflowFile(workflowDirPath)
    assertValidGraph(workflow)
    return workflow
  }

  events(runId: string): EngineEvent[] {
    return this.log.listByRun(runId).map((e) => e.event)
  }

  fold(runId: string): RunState | null {
    return foldEvents(this.events(runId))
  }

  /** Non-deleted runs in log order (DES-003). */
  listRuns(): RunState[] {
    const out: RunState[] = []
    for (const runId of this.log.listRunIds()) {
      const state = this.fold(runId)
      if (state && !state.deleted) out.push(state)
    }
    return out
  }

  /** Start a run from workflow.yaml under workflowDir. */
  startRun(options: StartRunOptions): RunHandle {
    const graph = this.loadWorkflow(options.workflowDir)
    const runId = options.runId ?? randomUUID()
    const runRoot = prepareRunDirs(options.workflowDir, runId, graph)

    this.log.append({
      type: "run_started",
      runId,
      workflowId: graph.id,
      graph,
      at: new Date().toISOString(),
    })

    const scheduler = this.attachScheduler(
      runId,
      options.workflowDir,
      runRoot,
      graph
    )
    scheduler.requestTick()

    return this.handleFor(runId, scheduler)
  }

  approveTask(runId: string, taskId: string): void {
    this.requireScheduler(runId).approve(taskId)
  }

  rejectTask(runId: string, taskId: string): void {
    this.requireScheduler(runId).reject(taskId)
  }

  cancelRun(runId: string): void {
    this.requireScheduler(runId).cancel()
  }

  /**
   * Append run_deleted then remove runs/<runId>/. Blocked while live.
   */
  deleteRun(runId: string): void {
    const state = this.fold(runId)
    if (!state) throw new Error(`unknown run ${runId}`)
    const root = runDir(workflowDir(this.home, state.workflowId), runId)
    deleteRunFiles(root, (event) => this.log.append(event), state)
    this.schedulers.delete(runId)
  }

  /**
   * Resume every run still `running` in the log: re-attach live pids or
   * record interrupted, then continue scheduling (DES-003 / BL-005).
   * Also finishes interrupted run deletions.
   */
  resumeAll(): RunHandle[] {
    this.finishPendingRemovals()
    const handles: RunHandle[] = []
    for (const runId of this.log.listRunIds()) {
      const handle = this.resumeRun(runId)
      if (handle) handles.push(handle)
    }
    return handles
  }

  /**
   * Resume one run if it is still running. Returns null if the run is
   * missing, deleted, or already terminal.
   */
  resumeRun(runId: string): RunHandle | null {
    const existing = this.schedulers.get(runId)
    if (existing) {
      return this.handleFor(runId, existing)
    }

    const state = this.fold(runId)
    if (!state || state.deleted || state.status !== "running") return null

    const workflowRoot = workflowDir(this.home, state.workflowId)
    const runRoot = runDir(workflowRoot, runId)
    const scheduler = this.attachScheduler(
      runId,
      workflowRoot,
      runRoot,
      state.graph
    )
    scheduler.resumeCancelIfNeeded()
    if (scheduler.state().status !== "running") {
      return this.handleFor(runId, scheduler)
    }
    scheduler.resumeOpenAttempts()
    scheduler.requestTick()
    return this.handleFor(runId, scheduler)
  }

  close(): void {
    this.log.close()
  }

  private finishPendingRemovals(): void {
    for (const runId of this.log.listRunIds()) {
      const state = this.fold(runId)
      if (!state?.deleted) continue
      const root = runDir(workflowDir(this.home, state.workflowId), runId)
      finishRunRemoval(root)
    }
  }

  private requireScheduler(runId: string): Scheduler {
    const existing = this.schedulers.get(runId)
    if (existing) return existing
    const handle = this.resumeRun(runId)
    if (!handle) throw new Error(`run ${runId} is not live`)
    const scheduler = this.schedulers.get(runId)
    if (!scheduler) throw new Error(`run ${runId} is not live`)
    return scheduler
  }

  private attachScheduler(
    runId: string,
    workflowRoot: string,
    runRoot: string,
    graph: Workflow
  ): Scheduler {
    const scheduler = new Scheduler({
      log: this.log,
      runId,
      workflowRoot,
      runRoot,
      graph,
    })
    this.schedulers.set(runId, scheduler)
    return scheduler
  }

  private handleFor(runId: string, scheduler: Scheduler): RunHandle {
    return {
      runId,
      wait: () => scheduler.wait(),
      state: () => scheduler.state(),
    }
  }
}

export function createEngine(options?: CreateEngineOptions): Engine {
  return new Engine(options)
}

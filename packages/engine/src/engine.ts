import { randomUUID } from "node:crypto"
import type {
  CliTrustValue,
  EngineEvent,
  RunSummary,
  TrustDecision,
  TrustGrant,
  Workflow,
  WorkflowLimits,
} from "@workspace/shared"
import { cancelQueuedRun } from "./cancel-queued.ts"
import { loadAppConfig } from "./config.ts"
import { deleteRunFiles, finishRunRemoval } from "./delete-run.ts"
import {
  prepareTrustMarker,
  reconcileEngineTrustMarker,
  trustDecisionFor,
} from "./engine-trust.ts"
import { EventLog, type StoredEvent } from "./event-log.ts"
import { foldEvents, isLiveRunStatus, type RunState } from "./fold.ts"
import { requestManualRetry } from "./manual-retry.ts"
import {
  appDbPath,
  resolveAppHome,
  resolveAppHomeRealpath,
  runDir,
  workflowDir,
} from "./paths.ts"
import { runPreflightChecks, type PreflightInput } from "./preflight.ts"
import { freeRunSlots, nextQueuedRun } from "./run-queue.ts"
import { RunSummaryCache, type ListRunSummariesOptions } from "./run-summary.ts"
import { Scheduler } from "./scheduler.ts"
import type { ManualFilePart } from "./source-manual.ts"
import { appendRunStarted } from "./start-run.ts"
import { decideTrust } from "./trust-policy.ts"
import { assertValidGraph, loadWorkflowFile } from "./workflow.ts"
import { workflowNeedsAgentCli } from "./workflow-agents.ts"

export type CreateEngineOptions = {
  home?: string
}

export type StartRunOptions = {
  workflowDir: string
  runId?: string
  trustGrant?: TrustGrant
  values?: Record<string, string>
  files?: ManualFilePart[]
  workItemId?: string
}

export type RunHandle = {
  runId: string
  status: "queued" | "running"
  wait: () => Promise<RunState>
  state: () => RunState
}

export class Engine {
  readonly home: string
  private readonly log: EventLog
  private readonly globalLimits: WorkflowLimits | undefined
  private readonly schedulers = new Map<string, Scheduler>()
  private readonly summaryCache: RunSummaryCache

  constructor(options: CreateEngineOptions = {}) {
    this.home = resolveAppHome(options.home)
    this.log = new EventLog(appDbPath(this.home))
    this.globalLimits = loadAppConfig(this.home).limits
    this.summaryCache = new RunSummaryCache((runId) => this.fold(runId))
    this.log.onAppend((stored) => {
      const summary = this.summaryCache.refresh(stored.event.runId)
      if (
        stored.event.type === "run_succeeded" ||
        stored.event.type === "run_failed" ||
        stored.event.type === "run_cancelled"
      ) {
        this.reconcileTrustMarker()
        if (summary) this.activateQueuedForWorkflow(summary.workflowId)
      }
    })
    this.rebuildSummaryCache()
  }

  homeRealpath(): string {
    return resolveAppHomeRealpath(this.home)
  }

  getCliTrust(): CliTrustValue | null {
    return this.log.getCliTrust()
  }

  trustDecision(): TrustDecision {
    return trustDecisionFor(this.homeRealpath(), this.getCliTrust())
  }

  setAlwaysTrust(): void {
    this.log.setCliTrust({
      homeRealpath: this.homeRealpath(),
      trustedAt: new Date().toISOString(),
    })
    prepareTrustMarker(this.homeRealpath())
  }

  revokeAlwaysTrust(): void {
    this.log.clearCliTrust()
    this.reconcileTrustMarker()
  }

  reconcileTrustMarker(): void {
    reconcileEngineTrustMarker({
      home: this.home,
      homeRealpath: this.homeRealpath(),
      settings: this.getCliTrust(),
      runs: this.listRuns(),
    })
  }

  async preflight(options: { workflowDir: string; attemptDir?: string }) {
    const workflow = this.loadWorkflow(options.workflowDir)
    const input: PreflightInput = {
      homeRealpath: this.homeRealpath(),
      home: this.home,
      workflowDir: options.workflowDir,
      workflow,
      attemptDir: options.attemptDir,
    }
    return {
      trust: this.trustDecision(),
      checks: await runPreflightChecks(input),
      needsAgentCli: workflowNeedsAgentCli(workflow),
    }
  }

  loadWorkflow(workflowDirPath: string): Workflow {
    const workflow = loadWorkflowFile(workflowDirPath)
    assertValidGraph(workflow)
    return workflow
  }

  events(runId: string): EngineEvent[] {
    return this.log.listByRun(runId).map((e) => e.event)
  }

  eventsWithSeq(runId: string): StoredEvent[] {
    return this.log.listByRun(runId)
  }

  onEvent(listener: (stored: StoredEvent) => void): () => void {
    return this.log.onAppend(listener)
  }

  fold(runId: string): RunState | null {
    return foldEvents(this.events(runId))
  }

  listRuns(): RunState[] {
    const out: RunState[] = []
    for (const runId of this.log.listRunIds()) {
      const state = this.fold(runId)
      if (state && !state.deleted) out.push(state)
    }
    return out
  }

  listRunsForWorkflow(workflowId: string): RunState[] {
    return this.listRuns()
      .filter((r) => r.workflowId === workflowId)
      .reverse()
  }

  /** Cached summaries; does not fold (DES-025 / BL-033). */
  listRunSummaries(opts?: ListRunSummariesOptions): RunSummary[] {
    return this.summaryCache.list(opts)
  }

  getRunSummary(runId: string): RunSummary | null {
    return this.summaryCache.get(runId)
  }

  hasLiveRun(workflowId: string): boolean {
    return this.listRunsForWorkflow(workflowId).some((r) =>
      isLiveRunStatus(r.status)
    )
  }

  rebindWorkflowId(fromId: string, toId: string): void {
    this.log.rebindWorkflowId(fromId, toId)
    this.rebuildSummaryCache()
  }

  markWorkflowRunsDeleted(workflowId: string): void {
    for (const state of this.listRunsForWorkflow(workflowId)) {
      if (isLiveRunStatus(state.status)) {
        throw new Error(`cannot delete live run ${state.runId}`)
      }
      this.log.append({
        type: "run_deleted",
        runId: state.runId,
        at: new Date().toISOString(),
      })
      this.schedulers.delete(state.runId)
    }
  }

  startRun(options: StartRunOptions): RunHandle {
    const graph = this.loadWorkflow(options.workflowDir)
    const runId = options.runId ?? randomUUID()
    const started = appendRunStarted({
      log: this.log,
      graph,
      params: {
        workflowDir: options.workflowDir,
        runId,
        trustGrant: options.trustGrant,
        values: options.values,
        files: options.files,
        workItemId: options.workItemId,
      },
      homeRealpath: this.homeRealpath(),
      settings: this.getCliTrust(),
      setAlwaysTrust: (value) => this.log.setCliTrust(value),
      workflowRuns: this.listRunsForWorkflow(graph.id),
    })

    if (started.queued) {
      return this.queuedHandle(started.runId)
    }
    const scheduler = this.attachScheduler(
      started.runId,
      options.workflowDir,
      started.runRoot
    )
    scheduler.requestTick()
    return this.handleFor(started.runId, scheduler, "running")
  }

  approveTask(runId: string, taskId: string): void {
    this.requireScheduler(runId).approve(taskId)
  }

  rejectTask(runId: string, taskId: string): void {
    this.requireScheduler(runId).reject(taskId)
  }

  cancelRun(runId: string): void {
    const state = this.fold(runId)
    if (!state || state.deleted) throw new Error(`unknown run ${runId}`)
    if (state.status === "queued") {
      cancelQueuedRun(state, (event) => this.log.append(event))
      return
    }
    this.requireScheduler(runId).cancel()
  }

  retryTask(runId: string, taskId: string): RunHandle {
    const state = this.fold(runId)
    if (!state) throw new Error(`unknown run ${runId}`)
    requestManualRetry(runId, taskId, state, (event) => this.log.append(event))
    this.schedulers.delete(runId)
    const workflowRoot = workflowDir(this.home, state.workflowId)
    const root = runDir(workflowRoot, runId)
    if (workflowNeedsAgentCli(state.graph)) {
      const decision = decideTrust({
        homeRealpath: this.homeRealpath(),
        settings: this.getCliTrust(),
        runGrant: state.trustGrant,
      })
      if (decision !== "none") {
        prepareTrustMarker(this.homeRealpath(), workflowRoot)
      }
    }
    const scheduler = this.attachScheduler(runId, workflowRoot, root)
    scheduler.requestTick()
    return this.handleFor(runId, scheduler, "running")
  }

  deleteRun(runId: string): void {
    const state = this.fold(runId)
    if (!state) throw new Error(`unknown run ${runId}`)
    const root = runDir(workflowDir(this.home, state.workflowId), runId)
    deleteRunFiles(root, (event) => this.log.append(event), state)
    this.schedulers.delete(runId)
  }

  resumeAll(): RunHandle[] {
    this.finishPendingRemovals()
    const handles: RunHandle[] = []
    for (const runId of this.log.listRunIds()) {
      const handle = this.resumeRun(runId)
      if (handle) handles.push(handle)
    }
    for (const workflowId of new Set(
      this.listRuns().map((r) => r.workflowId)
    )) {
      this.activateQueuedForWorkflow(workflowId)
    }
    this.reconcileTrustMarker()
    this.rebuildSummaryCache()
    return handles
  }

  resumeRun(runId: string): RunHandle | null {
    const existing = this.schedulers.get(runId)
    if (existing) return this.handleFor(runId, existing, "running")

    const state = this.fold(runId)
    if (!state || state.deleted || state.status !== "running") return null

    const workflowRoot = workflowDir(this.home, state.workflowId)
    const runRoot = runDir(workflowRoot, runId)
    const scheduler = this.attachScheduler(runId, workflowRoot, runRoot)
    scheduler.resumeCancelIfNeeded()
    if (scheduler.state().status !== "running") {
      return this.handleFor(runId, scheduler, "running")
    }
    scheduler.resumeOpenAttempts()
    scheduler.requestTick()
    return this.handleFor(runId, scheduler, "running")
  }

  close(): void {
    this.schedulers.clear()
    this.log.close()
  }

  private activateQueuedForWorkflow(workflowId: string): void {
    const workflowRoot = workflowDir(this.home, workflowId)
    let graph: Workflow
    try {
      graph = this.loadWorkflow(workflowRoot)
    } catch {
      return
    }
    for (;;) {
      const runs = this.listRunsForWorkflow(workflowId)
      if (freeRunSlots(graph, runs) <= 0) return
      const next = nextQueuedRun(runs)
      if (!next) return
      this.activateRun(next, workflowRoot)
    }
  }

  private activateRun(state: RunState, workflowRoot: string): void {
    this.log.append({
      type: "run_activated",
      runId: state.runId,
      at: new Date().toISOString(),
    })
    if (workflowNeedsAgentCli(state.graph)) {
      const decision = decideTrust({
        homeRealpath: this.homeRealpath(),
        settings: this.getCliTrust(),
        runGrant: state.trustGrant,
      })
      if (decision !== "none") {
        prepareTrustMarker(this.homeRealpath(), workflowRoot)
      }
    }
    const root = runDir(workflowRoot, state.runId)
    const scheduler = this.attachScheduler(state.runId, workflowRoot, root)
    scheduler.requestTick()
  }

  private rebuildSummaryCache(): void {
    this.summaryCache.rebuild(this.log.listRunIds())
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
    runRoot: string
  ): Scheduler {
    const scheduler = new Scheduler({
      log: this.log,
      runId,
      workflowRoot,
      runRoot,
      globalLimits: this.globalLimits,
    })
    this.schedulers.set(runId, scheduler)
    return scheduler
  }

  private handleFor(
    runId: string,
    scheduler: Scheduler,
    status: "queued" | "running"
  ): RunHandle {
    return {
      runId,
      status,
      wait: () => scheduler.wait(),
      state: () => scheduler.state(),
    }
  }

  private queuedHandle(runId: string): RunHandle {
    return {
      runId,
      status: "queued",
      state: () => {
        const state = this.fold(runId)
        if (!state) throw new Error(`unknown run ${runId}`)
        return state
      },
      wait: () => this.waitUntilTerminal(runId),
    }
  }

  private waitUntilTerminal(runId: string): Promise<RunState> {
    const current = this.fold(runId)
    if (!current) return Promise.reject(new Error(`unknown run ${runId}`))
    if (
      current.status === "succeeded" ||
      current.status === "failed" ||
      current.status === "cancelled"
    ) {
      return Promise.resolve(current)
    }
    const existing = this.schedulers.get(runId)
    if (existing) return existing.wait()
    return new Promise((resolve, reject) => {
      const unsub = this.log.onAppend((stored) => {
        if (stored.event.runId !== runId) return
        const state = this.fold(runId)
        if (!state) {
          unsub()
          reject(new Error(`unknown run ${runId}`))
          return
        }
        if (state.status === "running") {
          const scheduler = this.schedulers.get(runId)
          if (scheduler) {
            unsub()
            void scheduler.wait().then(resolve, reject)
          }
          return
        }
        if (
          state.status === "succeeded" ||
          state.status === "failed" ||
          state.status === "cancelled"
        ) {
          unsub()
          resolve(state)
        }
      })
    })
  }
}

export function createEngine(options?: CreateEngineOptions): Engine {
  return new Engine(options)
}

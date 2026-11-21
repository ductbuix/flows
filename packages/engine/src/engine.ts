import { randomUUID } from "node:crypto"
import type {
  CliTrustValue,
  EngineEvent,
  TrustDecision,
  TrustGrant,
  Workflow,
  WorkflowLimits,
} from "@workspace/shared"
import { loadAppConfig } from "./config.ts"
import { prepareRunDirs } from "./dirs.ts"
import { deleteRunFiles, finishRunRemoval } from "./delete-run.ts"
import {
  applyStartTrustGrant,
  prepareTrustMarker,
  reconcileEngineTrustMarker,
  trustDecisionFor,
} from "./engine-trust.ts"
import { EventLog, type StoredEvent } from "./event-log.ts"
import { foldEvents, type RunState } from "./fold.ts"
import { requestManualRetry } from "./manual-retry.ts"
import {
  appDbPath,
  resolveAppHome,
  resolveAppHomeRealpath,
  runDir,
  workflowDir,
} from "./paths.ts"
import { runPreflightChecks, type PreflightInput } from "./preflight.ts"
import { Scheduler } from "./scheduler.ts"
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
}

export type RunHandle = {
  runId: string
  wait: () => Promise<RunState>
  state: () => RunState
}

export class Engine {
  readonly home: string
  private readonly log: EventLog
  private readonly globalLimits: WorkflowLimits | undefined
  private readonly schedulers = new Map<string, Scheduler>()

  constructor(options: CreateEngineOptions = {}) {
    this.home = resolveAppHome(options.home)
    this.log = new EventLog(appDbPath(this.home))
    this.globalLimits = loadAppConfig(this.home).limits
    this.log.onAppend((stored) => {
      if (
        stored.event.type === "run_succeeded" ||
        stored.event.type === "run_failed" ||
        stored.event.type === "run_cancelled"
      ) {
        this.reconcileTrustMarker()
      }
    })
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

  hasLiveRun(workflowId: string): boolean {
    return this.listRunsForWorkflow(workflowId).some(
      (r) => r.status === "running"
    )
  }

  rebindWorkflowId(fromId: string, toId: string): void {
    this.log.rebindWorkflowId(fromId, toId)
  }

  markWorkflowRunsDeleted(workflowId: string): void {
    for (const state of this.listRunsForWorkflow(workflowId)) {
      if (state.status === "running") {
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
    const needsCli = workflowNeedsAgentCli(graph)
    const homeRealpath = this.homeRealpath()
    const settings = this.getCliTrust()

    if (needsCli) {
      applyStartTrustGrant(
        options.trustGrant,
        homeRealpath,
        settings,
        (value) => this.log.setCliTrust(value)
      )
    }

    const runId = options.runId ?? randomUUID()
    const runRoot = prepareRunDirs(options.workflowDir, runId, graph)
    const trustOnce =
      needsCli && options.trustGrant === "once" ? ("once" as const) : undefined

    this.log.append({
      type: "run_started",
      runId,
      workflowId: graph.id,
      graph,
      at: new Date().toISOString(),
      ...(trustOnce ? { trustGrant: trustOnce } : {}),
    })

    if (needsCli) prepareTrustMarker(homeRealpath, options.workflowDir)

    const scheduler = this.attachScheduler(runId, options.workflowDir, runRoot)
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
    return this.handleFor(runId, scheduler)
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
    this.reconcileTrustMarker()
    return handles
  }

  resumeRun(runId: string): RunHandle | null {
    const existing = this.schedulers.get(runId)
    if (existing) return this.handleFor(runId, existing)

    const state = this.fold(runId)
    if (!state || state.deleted || state.status !== "running") return null

    const workflowRoot = workflowDir(this.home, state.workflowId)
    const runRoot = runDir(workflowRoot, runId)
    const scheduler = this.attachScheduler(runId, workflowRoot, runRoot)
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

import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import type {
  NodeWorkflow,
  CliTrustValue,
  EngineEvent,
  RunSummary,
  TrustDecision,
  TrustGrant,
  Workflow,
  WorkflowLimits,
} from "@workspace/shared"
import { collectWorkflowIssues } from "@workspace/shared"
import { cancelQueuedRun } from "./cancel-queued.ts"
import { loadAppConfig } from "./config.ts"
import {
  materializeNodeRunResources,
  type MaterializeResourcesResult,
} from "./library-run.ts"
import { readWorkItem } from "./workitems.ts"
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
import {
  countRunningRuns,
  freeRunSlots,
  nextQueuedRun,
} from "./run-queue.ts"
import {
  approveNodeStep,
  cancelNodeRun,
  rejectNodeStep,
  requestNodeRetry,
} from "./nodes/cancel.ts"
import { resumeNodes, runNodes } from "./nodes/drive.ts"
import { assertNodePublishValid } from "./nodes/publish.ts"
import { recordUnpublishedLocalEffects } from "./work-copy.ts"
import type { StepsState } from "./nodes/fold-steps.ts"
import type { ProcessHost } from "./nodes/process.ts"
import { RunSummaryCache, type ListRunSummariesOptions } from "./run-summary.ts"
import { Scheduler } from "./scheduler.ts"
import type { ManualFilePart, ManualItem } from "./source-manual.ts"
import { assertPublishTasksValid } from "./publish.ts"
import { appendRunStarted } from "./start-run.ts"
import { assertNodeTemplatesValid } from "./nodes/answers.ts"
import { startNodeRun as startNodeRunQueued } from "./nodes/tick.ts"
import { assertPartialReady, type PartialRun } from "./nodes/partial.ts"
import {
  LIBRARY_RETENTION_INTERVAL_MS,
  sweepLibrary,
} from "./library-retention.ts"
import { decideTrust } from "./trust-policy.ts"
import { assertValidGraph, loadWorkflowFile } from "./workflow.ts"
import { runNeedsAgentCli, workflowAgentClis } from "./workflow-agents.ts"

export type CreateEngineOptions = {
  home?: string
}

export type StartRunOptions = {
  workflowDir: string
  runId?: string
  trustGrant?: TrustGrant
  values?: Record<string, string>
  files?: ManualFilePart[]
  /** Prior run to reuse library pins from (rerun; BL-043). */
  pinFromRunId?: string
  /** Pull and pin again instead of reusing prior pins (BL-043). */
  refreshPins?: boolean
  workItemId?: string
}

/** Start a node run (DES-034). The caller parses and validates the graph. */
export type StartNodeRunInput = {
  graph: NodeWorkflow
  runId?: string
  trigger?: string
  /** Frozen as `input/text.md`. */
  inputText?: string
  /** Declared Trigger inputs and uploads, frozen under `input/` (BL-104). */
  inputs?: ManualItem
  workItemId?: string
  /** Pins from `pinNodeRun`, appended as `library_pulled` after `run_started` (BL-082). */
  pins?: MaterializeResourcesResult
  /** Run step or Run from here (BL-102); `baseRunId` defaults to the latest run. */
  partial?: { only?: string; from?: string; baseRunId?: string }
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
  /** Live node-run drivers by run id (DES-034). */
  private readonly nodeRuns = new Map<string, Promise<StepsState>>()
  /** Wake handles of those drivers, so Approve can tick a waiting run. */
  private readonly nodeHosts = new Map<string, ProcessHost>()
  private retentionTimer: ReturnType<typeof setInterval> | undefined

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
      needsAgentCli: runNeedsAgentCli(this.home, workflow),
      clis: workflowAgentClis(workflow, this.home),
    }
  }

  loadWorkflow(workflowDirPath: string): Workflow {
    const workflow = loadWorkflowFile(workflowDirPath)
    assertValidGraph(workflow)
    const issues = collectWorkflowIssues(workflow)
    if (issues[0]) throw new Error(issues[0].message)
    assertPublishTasksValid(this.home, workflow)
    return workflow
  }

  events(runId: string): EngineEvent[] {
    return this.log.listByRun(runId).map((e) => e.event)
  }

  /** Append a library_pulled (or similar) effect event (BL-043). */
  appendLibraryEvent(event: EngineEvent): void {
    this.log.append(event)
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

  async startRun(options: StartRunOptions): Promise<RunHandle> {
    const graph = this.loadWorkflow(options.workflowDir)
    const runId = options.runId ?? randomUUID()
    const pinFromRunRoot = (() => {
      if (!options.pinFromRunId) return undefined
      const prior = this.fold(options.pinFromRunId)
      if (!prior) return undefined
      return runDir(
        workflowDir(this.home, prior.workflowId),
        options.pinFromRunId
      )
    })()
    const started = await appendRunStarted({
      log: this.log,
      graph,
      params: {
        workflowDir: options.workflowDir,
        runId,
        trustGrant: options.trustGrant,
        values: options.values,
        files: options.files,
        home: this.home,
        pinFromRunRoot,
        refreshPins: options.refreshPins,
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

  /**
   * Pulls and pins the Asset resources of a node run, with the work item's
   * links, before it starts (BL-082). Undefined when the graph has no
   * Asset node. Pass the result and `runId` to `startNodeRun`.
   */
  async pinNodeRun(input: {
    graph: NodeWorkflow
    runId: string
    workItemId?: string
    /** Reuse the pins of this run (rerun, partial runs) unless `refreshPins`. */
    pinFromRunId?: string
    refreshPins?: boolean
  }): Promise<MaterializeResourcesResult | undefined> {
    assertNodePublishValid(this.home, input.graph)
    assertNodeTemplatesValid(this.home, input.graph)
    if (!input.graph.nodes.some((n) => n.kind === "asset")) return undefined
    const runRoot = runDir(workflowDir(this.home, input.graph.id), input.runId)
    mkdirSync(runRoot, { recursive: true })
    const links =
      input.workItemId !== undefined
        ? (readWorkItem(this.home, input.workItemId)?.item.links ?? [])
        : []
    return materializeNodeRunResources({
      home: this.home,
      graph: input.graph,
      runRoot,
      runId: input.runId,
      workItemLinks: links,
      pinFromRunRoot: this.runRootOf(input.pinFromRunId),
      refreshPins: input.refreshPins,
    })
  }

  private runRootOf(runId: string | undefined): string | undefined {
    const prior = runId === undefined ? undefined : this.fold(runId)
    return prior && runId !== undefined
      ? runDir(workflowDir(this.home, prior.workflowId), runId)
      : undefined
  }

  /**
   * Starts a node run: freezes the graph, then drives it, or queues it
   * under `maxConcurrentRuns` (BL-093). Resolves `wait()` when it ends.
   */
  startNodeRun(input: StartNodeRunInput): RunHandle {
    const { graph } = input
    assertNodePublishValid(this.home, graph)
    assertNodeTemplatesValid(this.home, graph)
    const runId = input.runId ?? randomUUID()
    const queued =
      countRunningRuns(this.listRunsForWorkflow(graph.id)) >=
      (graph.limits?.maxConcurrentRuns ?? 1)
    const partial = input.partial
      ? this.partialOf(graph, runId, input.partial)
      : undefined
    const opts = {
      log: this.log,
      home: this.home,
      runId,
      graph,
      ...(partial ? { partial } : {}),
      trigger: input.trigger,
      inputText: input.inputText,
      inputs: input.inputs,
      workItemId: input.workItemId,
      pins: input.pins,
    }
    if (queued) {
      startNodeRunQueued({ ...opts, queued: true })
      return this.queuedHandle(runId)
    }
    return this.trackNodeRun(runId, runNodes(opts, this.hostSink(runId)))
  }

  /** Earlier node runs to build a partial run on, the base first (BL-102). */
  private partialOf(
    graph: NodeWorkflow,
    runId: string,
    request: NonNullable<StartNodeRunInput["partial"]>
  ): PartialRun | undefined {
    if (request.only === undefined && request.from === undefined) {
      return undefined
    }
    const earlier = this.listRunsForWorkflow(graph.id)
      .filter((r) => r.nodeGraph && !r.deleted && r.runId !== runId)
      .map((r) => r.runId)
    if (request.baseRunId !== undefined && !earlier.includes(request.baseRunId)) {
      throw new Error(`unknown base run ${request.baseRunId}`)
    }
    const partial: PartialRun = {
      only: request.only,
      from: request.from,
      bases: [
        ...(request.baseRunId !== undefined ? [request.baseRunId] : []),
        ...earlier.filter((id) => id !== request.baseRunId),
      ],
    }
    assertPartialReady({
      log: this.log,
      home: this.home,
      workflowId: graph.id,
      graph,
      partial,
    })
    return partial
  }

  /** Run id that pins and inputs of a partial run come from, if any. */
  latestNodeRunId(workflowId: string, baseRunId?: string): string | undefined {
    if (baseRunId !== undefined) return baseRunId
    return this.listRunsForWorkflow(workflowId).find(
      (r) => r.nodeGraph && !r.deleted
    )?.runId
  }

  private trackNodeRun(runId: string, done: Promise<StepsState>): RunHandle {
    const tracked = this.recordLocalEffects(runId, done).catch((error: unknown) => {
      // A broken graph or a crash in the tick must not leave a run open.
      const state = this.fold(runId)
      if (state && state.status === "running") {
        this.log.append({
          type: "run_failed",
          runId,
          at: new Date().toISOString(),
        })
      }
      throw error
    })
    this.nodeRuns.set(runId, tracked)
    const clear = () => {
      if (this.nodeRuns.get(runId) === tracked) {
        this.nodeRuns.delete(runId)
        this.nodeHosts.delete(runId)
      }
    }
    tracked.then(clear, clear)
    return this.nodeHandle(runId, tracked)
  }

  /** Unpublished work copy changes at run end stay Local (DES-026, BL-084). */
  private async recordLocalEffects(
    runId: string,
    done: Promise<StepsState>
  ): Promise<StepsState> {
    const steps = await done
    const state = this.fold(runId)
    if (state && !state.deleted) {
      await recordUnpublishedLocalEffects({
        home: this.home,
        runRoot: runDir(workflowDir(this.home, state.workflowId), runId),
        runId,
        append: (event) => this.log.append(event),
      })
    }
    return steps
  }

  private nodeHandle(runId: string, done: Promise<StepsState>): RunHandle {
    return {
      runId,
      status: "running",
      state: () => this.mustFold(runId),
      wait: async () => {
        await done
        return this.mustFold(runId)
      },
    }
  }

  /** Ticks a live node run again after a person decided (BL-080). */
  private wakeNodeRun(runId: string): void {
    const host = this.nodeHosts.get(runId)
    if (host) {
      host.wake()
      return
    }
    this.nodeRuns.delete(runId)
    this.trackNodeRun(runId, resumeNodes(this.nodeOpts(runId), this.hostSink(runId)))
  }

  private hostSink(runId: string): (host: ProcessHost) => void {
    return (host) => {
      this.nodeHosts.set(runId, host)
    }
  }

  private mustFold(runId: string): RunState {
    const state = this.fold(runId)
    if (!state) throw new Error(`unknown run ${runId}`)
    return state
  }

  approveTask(runId: string, taskId: string): void {
    if (this.fold(runId)?.nodeGraph) {
      approveNodeStep(this.log, runId, taskId)
      this.wakeNodeRun(runId)
      return
    }
    this.requireScheduler(runId).approve(taskId)
  }

  rejectTask(runId: string, taskId: string): void {
    if (this.fold(runId)?.nodeGraph) {
      rejectNodeStep(this.log, runId, taskId)
      this.wakeNodeRun(runId)
      return
    }
    this.requireScheduler(runId).reject(taskId)
  }

  cancelRun(runId: string): void {
    const state = this.fold(runId)
    if (!state || state.deleted) throw new Error(`unknown run ${runId}`)
    if (state.status === "queued") {
      if (state.nodeGraph) cancelNodeRun(this.log, runId)
      else cancelQueuedRun(state, (event) => this.log.append(event))
      return
    }
    if (state.nodeGraph) {
      if (state.status !== "running") {
        throw new Error(`run ${runId} is not live`)
      }
      cancelNodeRun(this.log, runId)
      return
    }
    this.requireScheduler(runId).cancel()
  }

  retryTask(runId: string, taskId: string): RunHandle {
    const state = this.fold(runId)
    if (!state) throw new Error(`unknown run ${runId}`)
    if (state.nodeGraph) {
      if (state.deleted) throw new Error(`run ${runId} is deleted`)
      requestNodeRetry(this.log, runId, taskId, state.nodeGraph.edges)
      this.nodeRuns.delete(runId)
      return this.trackNodeRun(runId, resumeNodes(this.nodeOpts(runId), this.hostSink(runId)))
    }
    requestManualRetry(runId, taskId, state, (event) => this.log.append(event))
    this.schedulers.delete(runId)
    const workflowRoot = workflowDir(this.home, state.workflowId)
    const root = runDir(workflowRoot, runId)
    if (runNeedsAgentCli(this.home, state.graph)) {
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
    this.nodeRuns.delete(runId)
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
    if (state.nodeGraph) {
      const live = this.nodeRuns.get(runId)
      if (live) return this.nodeHandle(runId, live)
      return this.trackNodeRun(runId, resumeNodes(this.nodeOpts(runId), this.hostSink(runId)))
    }

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

  /** Run ids with queued or running status (block shared-clone gc). */
  liveRunIds(): string[] {
    return this.listRuns()
      .filter((r) => isLiveRunStatus(r.status))
      .map((r) => r.runId)
  }

  /**
   * Sweep unpinned revisions on start and every hour (DES-026 / BL-047).
   * Call from the server process only; tests invoke sweepLibrary directly.
   */
  startLibraryRetention(): void {
    if (this.retentionTimer) return
    const tick = () => {
      void sweepLibrary(this.home, { liveRunIds: this.liveRunIds() })
    }
    tick()
    this.retentionTimer = setInterval(tick, LIBRARY_RETENTION_INTERVAL_MS)
    this.retentionTimer.unref?.()
  }

  close(): void {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer)
      this.retentionTimer = undefined
    }
    for (const scheduler of this.schedulers.values()) scheduler.dispose()
    this.schedulers.clear()
    this.log.close()
  }

  private nodeOpts(runId: string) {
    return { log: this.log, home: this.home, runId }
  }

  private activateQueuedForWorkflow(workflowId: string): void {
    const workflowRoot = workflowDir(this.home, workflowId)
    let graph: Workflow | undefined
    for (;;) {
      const runs = this.listRunsForWorkflow(workflowId)
      const next = nextQueuedRun(runs)
      if (!next) return
      if (next.nodeGraph) {
        const cap = next.nodeGraph.limits?.maxConcurrentRuns ?? 1
        if (countRunningRuns(runs) >= cap) return
        this.log.append({
          type: "run_activated",
          runId: next.runId,
          at: new Date().toISOString(),
        })
        this.trackNodeRun(next.runId, resumeNodes(this.nodeOpts(next.runId), this.hostSink(next.runId)))
        continue
      }
      if (!graph) {
        try {
          graph = this.loadWorkflow(workflowRoot)
        } catch {
          return
        }
      }
      if (freeRunSlots(graph, runs) <= 0) return
      this.activateRun(next, workflowRoot)
    }
  }

  private activateRun(state: RunState, workflowRoot: string): void {
    this.log.append({
      type: "run_activated",
      runId: state.runId,
      at: new Date().toISOString(),
    })
    if (runNeedsAgentCli(this.home, state.graph)) {
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
      home: this.home,
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

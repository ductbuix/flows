import { mkdirSync } from "node:fs"
import type {
  CliTrustValue,
  EngineEvent,
  NoticeList,
  RunSummary,
  TrustDecision,
  Workflow,
} from "@workspace/contracts"
import {
  materializeNodeRunResources,
  type MaterializeResourcesResult,
} from "./library-run.ts"
import { deleteRunFiles, finishRunRemoval } from "./delete-run.ts"
import {
  prepareTrustMarker,
  reconcileEngineTrustMarker,
  trustDecisionFor,
} from "./engine-trust.ts"
import type { EventStore } from "@workspace/core/ports"
import { EventLog, type StoredEvent } from "./event-log.ts"
import {
  appDbPath,
  resolveAppHome,
  resolveAppHomeRealpath,
  runDir,
  workflowDir,
} from "./paths.ts"
import { cancelNodeRun } from "./nodes/cancel.ts"
import { assertNodePublishValid } from "./nodes/publish-assert.ts"
import {
  foldEvents,
  isLiveRunStatus,
  type RunState,
} from "./nodes/run-state.ts"
import { RunSummaryCache, type ListRunSummariesOptions } from "./run-summary.ts"
import { assertNodeTemplatesValid } from "./nodes/template-assert.ts"
import {
  LIBRARY_RETENTION_INTERVAL_MS,
  sweepLibrary,
} from "./library-retention.ts"
import { ensureBlobStore } from "./blob-store.ts"

export type CreateHostOptions = {
  home?: string
}

/**
 * Event log, library, settings and fold helpers. Live runs are driven by
 * the shared FCP core host (BL-197), not this class.
 */
export class Host {
  readonly home: string
  private readonly log: EventLog
  private readonly summaryCache: RunSummaryCache
  private retentionTimer: ReturnType<typeof setInterval> | undefined

  constructor(options: CreateHostOptions = {}) {
    this.home = resolveAppHome(options.home)
    ensureBlobStore(this.home)
    this.log = new EventLog(appDbPath(this.home))
    this.summaryCache = new RunSummaryCache((runId) => this.fold(runId))
    this.log.onAppend((stored) => {
      this.summaryCache.refresh(stored.event.runId)
      if (
        stored.event.type === "run_succeeded" ||
        stored.event.type === "run_failed" ||
        stored.event.type === "run_cancelled"
      ) {
        this.reconcileTrustMarker()
      }
    })
    this.rebuildSummaryCache()
  }

  homeRealpath(): string {
    return resolveAppHomeRealpath(this.home)
  }

  listNotices(): NoticeList {
    return this.log.listNotices()
  }

  /** Post an in-app notice (core notify path; BL-195). */
  postNotice(n: Parameters<EventLog["postNotice"]>[0]): boolean {
    return this.log.postNotice(n)
  }

  markNoticesRead(ids?: number[]): void {
    this.log.markNoticesRead(ids)
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

  /** Shared EventStore for core RunActor (BL-194); notifies `onEvent`. */
  eventStore(): EventStore {
    return this.log.asEventStore()
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
    }
  }

  /**
   * Pulls and pins the Asset resources of a node run before it starts (BL-082).
   * Undefined when the graph has no Asset.
   */
  async pinNodeRun(input: {
    graph: Workflow
    runId: string
    cardId?: string
    /** Reuse the pins of this run (rerun, partial runs) unless `refreshPins`. */
    pinFromRunId?: string
    refreshPins?: boolean
  }): Promise<MaterializeResourcesResult | undefined> {
    assertNodePublishValid(this.home, input.graph)
    assertNodeTemplatesValid(this.home, input.graph)
    if (!input.graph.nodes.some((n) => n.kind === "asset")) return undefined
    const runRoot = runDir(workflowDir(this.home, input.graph.id), input.runId)
    mkdirSync(runRoot, { recursive: true })
    void input.cardId
    return materializeNodeRunResources({
      home: this.home,
      graph: input.graph,
      runRoot,
      runId: input.runId,
      cardLinks: [],
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

  /** Run id that pins and inputs of a partial run come from, if any. */
  latestNodeRunId(workflowId: string, baseRunId?: string): string | undefined {
    if (baseRunId !== undefined) return baseRunId
    return this.listRunsForWorkflow(workflowId).find(
      (r) => r.graph && !r.deleted
    )?.runId
  }

  cancelRun(runId: string): void {
    const state = this.fold(runId)
    if (!state || state.deleted) throw new Error(`unknown run ${runId}`)
    if (state.status !== "queued" && state.status !== "running") {
      throw new Error(`run ${runId} is not live`)
    }
    cancelNodeRun(this.log, runId)
  }

  deleteRun(runId: string): void {
    const state = this.fold(runId)
    if (!state) throw new Error(`unknown run ${runId}`)
    const root = runDir(workflowDir(this.home, state.workflowId), runId)
    deleteRunFiles(root, (event) => this.log.append(event), state)
  }

  /**
   * Removals, trust marker and summary cache after a process start.
   * Run drivers resume via the core host (BL-197).
   */
  bootHousekeeping(): void {
    this.finishPendingRemovals()
    this.reconcileTrustMarker()
    this.rebuildSummaryCache()
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
    this.log.close()
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
}

export function createHost(options?: CreateHostOptions): Host {
  return new Host(options)
}

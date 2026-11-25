import type {
  CliTrustValue,
  EngineEvent,
  NoticeList,
  RunSummary,
  TrustDecision,
} from "@workspace/contracts"
import type { MaterializeResourcesResult } from "./library-run.ts"
import type { EventStore } from "@workspace/core/ports"
import { EventLog, type StoredEvent } from "./event-log.ts"
import { appDbPath, resolveAppHome, resolveAppHomeRealpath } from "./paths.ts"
import { cancelNodeRun } from "./nodes/cancel.ts"
import {
  foldEvents,
  isLiveRunStatus,
  type RunState,
} from "./nodes/run-state.ts"
import { RunSummaryCache, type ListRunSummariesOptions } from "./run-summary.ts"
import {
  LIBRARY_RETENTION_INTERVAL_MS,
  sweepLibrary,
} from "./library-retention.ts"
import { ensureBlobStore } from "./blob-store.ts"
import { listLoggedRuns } from "./log-runs.ts"
import * as runRemoval from "./run-removal.ts"
import type { PinNodeRunInput } from "./run-removal.ts"
import * as trust from "./trust.ts"

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
    return trust.getCliTrust(this.log)
  }

  trustDecision(): TrustDecision {
    return trust.trustDecision(this.log, this.home)
  }

  setAlwaysTrust(): void {
    trust.setAlwaysTrust(this.log, this.home)
  }

  revokeAlwaysTrust(): void {
    trust.revokeAlwaysTrust(this.log, this.home)
  }

  reconcileTrustMarker(): void {
    trust.reconcileTrustMarker(this.log, this.home)
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
    return listLoggedRuns(this.log)
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
    runRemoval.markWorkflowRunsDeleted(
      this.log,
      this.listRunsForWorkflow(workflowId)
    )
  }

  /**
   * Pulls and pins the Asset resources of a node run before it starts (BL-082).
   * Undefined when the graph has no Asset.
   */
  async pinNodeRun(
    input: PinNodeRunInput
  ): Promise<MaterializeResourcesResult | undefined> {
    return runRemoval.pinNodeRun(this.log, this.home, input)
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
    runRemoval.deleteRun(this.log, this.home, runId)
  }

  /**
   * Removals, trust marker and summary cache after a process start.
   * Run drivers resume via the core host (BL-197).
   */
  bootHousekeeping(): void {
    runRemoval.finishPendingRemovals(this.log, this.home)
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
}

export function createHost(options?: CreateHostOptions): Host {
  return new Host(options)
}

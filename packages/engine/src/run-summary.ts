import type { RunSummary, RunStatus } from "@workspace/shared"
import type { RunState } from "./fold.ts"

const DONE = new Set(["succeeded", "failed", "skipped", "cancelled"])

/** Derive a list-row summary from folded run state (DES-025 / BL-033). */
export function summarizeRun(state: RunState): RunSummary | null {
  if (state.deleted) return null

  const tasks = state.graph.tasks
  const needsYou: RunSummary["needsYou"] = []
  let done = 0
  let firstFailedTaskId: string | undefined

  for (const spec of tasks) {
    const task = state.tasks[spec.id]
    const status = task?.status ?? "pending"
    if (DONE.has(status)) done += 1
    if (status === "awaiting_approval") {
      needsYou.push({ taskId: spec.id })
    }
    if (status === "failed" && firstFailedTaskId === undefined) {
      firstFailedTaskId = spec.id
    }
  }

  const live = state.status === "running" || state.status === "queued"
  return {
    id: state.runId,
    workflowId: state.workflowId,
    workflowName: state.graph.id,
    status: state.status,
    needsYou,
    taskCounts: { done, total: tasks.length },
    ...(firstFailedTaskId !== undefined ? { firstFailedTaskId } : {}),
    ...(state.itemKey !== undefined ? { itemKey: state.itemKey } : {}),
    ...(state.workItemId !== undefined ? { workItemId: state.workItemId } : {}),
    startedAt: state.startedAt ?? new Date(0).toISOString(),
    ...(live || state.finishedAt === undefined
      ? {}
      : { finishedAt: state.finishedAt }),
  }
}

export type ListRunSummariesOptions = {
  status?: RunStatus
  workflowId?: string
  workItemId?: string
  /** Cap; default 100. */
  limit?: number
}

export class RunSummaryCache {
  private readonly byId = new Map<string, RunSummary>()

  constructor(private readonly fold: (runId: string) => RunState | null) {}

  rebuild(runIds: Iterable<string>): void {
    this.byId.clear()
    for (const runId of runIds) this.refresh(runId)
  }

  refresh(runId: string): RunSummary | null {
    const state = this.fold(runId)
    const summary = state ? summarizeRun(state) : null
    if (!summary) {
      this.byId.delete(runId)
      return null
    }
    this.byId.set(runId, summary)
    return summary
  }

  get(runId: string): RunSummary | null {
    return this.byId.get(runId) ?? null
  }

  list(opts: ListRunSummariesOptions = {}): RunSummary[] {
    const limit = opts.limit ?? 100
    let items = [...this.byId.values()]
    if (opts.status !== undefined) {
      items = items.filter((s) => s.status === opts.status)
    }
    if (opts.workflowId !== undefined) {
      items = items.filter((s) => s.workflowId === opts.workflowId)
    }
    if (opts.workItemId !== undefined) {
      items = items.filter((s) => s.workItemId === opts.workItemId)
    }
    items.sort((a, b) => {
      const byTime = b.startedAt.localeCompare(a.startedAt)
      return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
    })
    return items.slice(0, limit)
  }
}

import type { RunSummary } from "@workspace/shared"

export type NeedsYouItem = {
  run: RunSummary
  taskId: string
  connectionId?: string
}

export function isLiveRun(run: RunSummary): boolean {
  return run.status === "queued" || run.status === "running"
}

export function isFinishedRun(run: RunSummary): boolean {
  return (
    run.status === "succeeded" ||
    run.status === "failed" ||
    run.status === "cancelled"
  )
}

/** Flatten needsYou entries across runs (approval tasks waiting on a person). */
export function collectNeedsYou(runs: RunSummary[]): NeedsYouItem[] {
  const items: NeedsYouItem[] = []
  for (const run of runs) {
    for (const entry of run.needsYou) {
      items.push({
        run,
        taskId: entry.taskId,
        ...(entry.connectionId !== undefined
          ? { connectionId: entry.connectionId }
          : {}),
      })
    }
  }
  return items
}

/** Live runs, newest first (list already sorted). */
export function collectRunning(runs: RunSummary[]): RunSummary[] {
  return runs.filter(isLiveRun)
}

/** Last N finished runs by finishedAt (fallback startedAt), newest first. */
export function collectRecent(runs: RunSummary[], limit = 10): RunSummary[] {
  return runs
    .filter(isFinishedRun)
    .sort((a, b) => {
      const aAt = a.finishedAt ?? a.startedAt
      const bAt = b.finishedAt ?? b.startedAt
      const byTime = bAt.localeCompare(aAt)
      return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
    })
    .slice(0, limit)
}

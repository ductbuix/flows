import type { RunSummary, WorkItemSummary } from "@workspace/shared"
import { isFinishedRun, isLiveRun } from "./home-run-filters"

export type HomeWorkItem = {
  item: WorkItemSummary
  run: RunSummary
}

function runTime(run: RunSummary): string {
  return run.finishedAt ?? run.startedAt
}

/**
 * Work items that have a live or finished run, newest run first (BL-041).
 */
export function collectHomeWorkItems(
  runs: RunSummary[],
  items: WorkItemSummary[]
): HomeWorkItem[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const newest = new Map<string, RunSummary>()
  for (const run of runs) {
    if (!run.workItemId) continue
    if (!isLiveRun(run) && !isFinishedRun(run)) continue
    if (!byId.has(run.workItemId)) continue
    const prev = newest.get(run.workItemId)
    if (!prev || runTime(run).localeCompare(runTime(prev)) > 0) {
      newest.set(run.workItemId, run)
    }
  }

  return [...newest.entries()]
    .map(([id, run]) => ({ item: byId.get(id)!, run }))
    .sort((a, b) => {
      const byTime = runTime(b.run).localeCompare(runTime(a.run))
      return byTime !== 0 ? byTime : a.item.id.localeCompare(b.item.id)
    })
}

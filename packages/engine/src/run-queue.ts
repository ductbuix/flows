import type { RunState } from "./nodes/run-state.ts"

export function countRunningRuns(runs: RunState[]): number {
  return runs.filter((r) => r.status === "running").length
}

/**
 * Oldest queued run by run_started.at (stored as startedAt on fold).
 */
export function nextQueuedRun(workflowRuns: RunState[]): RunState | null {
  const queued = workflowRuns
    .filter((r) => r.status === "queued")
    .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
  return queued[0] ?? null
}

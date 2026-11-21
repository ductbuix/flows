import type { Workflow } from "@workspace/shared"
import type { RunState } from "./fold.ts"

/** maxConcurrentRuns from workflow.yaml; omitted means 1 (DES-021). */
export function maxConcurrentRuns(workflow: Workflow): number {
  return workflow.limits?.maxConcurrentRuns ?? 1
}

export function countRunningRuns(runs: RunState[]): number {
  return runs.filter((r) => r.status === "running").length
}

/** True when starting another run would exceed the cap. */
export function shouldQueueRun(
  workflow: Workflow,
  workflowRuns: RunState[]
): boolean {
  return countRunningRuns(workflowRuns) >= maxConcurrentRuns(workflow)
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

/** How many queued runs can activate given free slots. */
export function freeRunSlots(
  workflow: Workflow,
  workflowRuns: RunState[]
): number {
  return Math.max(
    0,
    maxConcurrentRuns(workflow) - countRunningRuns(workflowRuns)
  )
}

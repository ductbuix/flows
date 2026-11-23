import { useSyncExternalStore } from "react"
import { getWorkflows } from "./workflows-store"
import { RUNS, type MockRun } from "./workflows-data"

/** In-memory runs shared by Workflows, the editor and the card panel. */
let runs: MockRun[] = RUNS
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useRuns(): MockRun[] {
  return useSyncExternalStore(subscribe, () => runs)
}

/** Starts the next attempt of a workflow for a card. */
export function startRun(
  workflowId: string,
  cardId: string,
  given?: Record<string, string>
): MockRun {
  const attempt =
    runs.filter((r) => r.workflowId === workflowId && r.cardId === cardId)
      .length + 1
  const inputs = given ?? Object.fromEntries(
    (getWorkflows().find((w) => w.id === workflowId)?.inputs ?? []).map((i) => [i, "—"])
  )
  const run: MockRun = {
    id: `r-${200 + runs.length}`,
    workflowId,
    cardId,
    attempt,
    reason: attempt === 1 ? "First run" : "Rework",
    inputs,
    tone: "working",
    label: "Running",
    ago: "just now",
    duration: "0m",
  }
  runs = [run, ...runs]
  listeners.forEach((fn) => fn())
  return run
}

/** A person answers the approval a run is waiting on. */
export function decideRun(
  runId: string,
  decision: "approved" | "rejected",
  note?: string
) {
  runs = runs.map((r) =>
    r.id !== runId
      ? r
      : decision === "approved"
        ? { ...r, decision, note, tone: "working", label: "Running" }
        : { ...r, decision, note, tone: "failed", label: "Rejected" }
  )
  listeners.forEach((fn) => fn())
}

export function removeRunsOf(workflowId: string) {
  runs = runs.filter((r) => r.workflowId !== workflowId)
  listeners.forEach((fn) => fn())
}

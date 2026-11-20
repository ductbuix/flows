import { existsSync, rmSync } from "node:fs"
import type { EngineEvent } from "@workspace/shared"
import type { RunState } from "./fold.ts"

function now(): string {
  return new Date().toISOString()
}

/**
 * Append the deleted marker then remove runs/<runId>/. If the process
 * dies between the two, resume calls finishRunRemoval (DES-003).
 */
export function deleteRunFiles(
  runRoot: string,
  append: (event: EngineEvent) => void,
  state: RunState
): void {
  if (state.deleted) {
    finishRunRemoval(runRoot)
    return
  }
  if (state.status === "running") {
    throw new Error(`cannot delete live run ${state.runId}`)
  }

  append({
    type: "run_deleted",
    runId: state.runId,
    at: now(),
  })
  finishRunRemoval(runRoot)
}

/** Remove the run directory if it still exists. */
export function finishRunRemoval(runRoot: string): void {
  if (!existsSync(runRoot)) return
  rmSync(runRoot, { recursive: true, force: true })
}

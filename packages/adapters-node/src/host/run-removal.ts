import { mkdirSync } from "node:fs"
import type { Workflow } from "@workspace/contracts"
import { deleteRunFiles, finishRunRemoval } from "./delete-run.ts"
import type { EventLog } from "./event-log.ts"
import { foldLoggedRun } from "./log-runs.ts"
import {
  materializeNodeRunResources,
  type MaterializeResourcesResult,
} from "./library-run.ts"
import { runDir, workflowDir } from "./paths.ts"
import { assertNodePublishValid } from "./nodes/publish-assert.ts"
import { isLiveRunStatus, type RunState } from "./nodes/run-state.ts"
import { assertNodeTemplatesValid } from "./nodes/template-assert.ts"

export type PinNodeRunInput = {
  graph: Workflow
  runId: string
  cardId?: string
  /** Reuse the pins of this run (rerun, partial runs) unless `refreshPins`. */
  pinFromRunId?: string
  refreshPins?: boolean
}

export function markWorkflowRunsDeleted(
  log: EventLog,
  runs: readonly RunState[]
): void {
  for (const state of runs) {
    if (isLiveRunStatus(state.status)) {
      throw new Error(`cannot delete live run ${state.runId}`)
    }
    log.append({
      type: "run_deleted",
      runId: state.runId,
      at: new Date().toISOString(),
    })
  }
}

function runRootOf(
  log: EventLog,
  home: string,
  runId: string | undefined
): string | undefined {
  const prior = runId === undefined ? undefined : foldLoggedRun(log, runId)
  return prior && runId !== undefined
    ? runDir(workflowDir(home, prior.workflowId), runId)
    : undefined
}

/**
 * Pulls and pins the Asset resources of a node run before it starts (BL-082).
 * Undefined when the graph has no Asset.
 */
export async function pinNodeRun(
  log: EventLog,
  home: string,
  input: PinNodeRunInput
): Promise<MaterializeResourcesResult | undefined> {
  assertNodePublishValid(home, input.graph)
  assertNodeTemplatesValid(home, input.graph)
  if (!input.graph.nodes.some((n) => n.kind === "asset")) return undefined
  const runRoot = runDir(workflowDir(home, input.graph.id), input.runId)
  mkdirSync(runRoot, { recursive: true })
  void input.cardId
  return materializeNodeRunResources({
    home,
    graph: input.graph,
    runRoot,
    runId: input.runId,
    cardLinks: [],
    pinFromRunRoot: runRootOf(log, home, input.pinFromRunId),
    refreshPins: input.refreshPins,
  })
}

export function deleteRun(log: EventLog, home: string, runId: string): void {
  const state = foldLoggedRun(log, runId)
  if (!state) throw new Error(`unknown run ${runId}`)
  const root = runDir(workflowDir(home, state.workflowId), runId)
  deleteRunFiles(root, (event) => log.append(event), state)
}

export function finishPendingRemovals(log: EventLog, home: string): void {
  for (const runId of log.listRunIds()) {
    const state = foldLoggedRun(log, runId)
    if (!state?.deleted) continue
    const root = runDir(workflowDir(home, state.workflowId), runId)
    finishRunRemoval(root)
  }
}

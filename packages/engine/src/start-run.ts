import type { EngineEvent, TrustGrant, Workflow } from "@workspace/shared"
import { workflowNeedsAgentCli } from "./workflow-agents.ts"
import { prepareRunDirs } from "./dirs.ts"
import { applyStartTrustGrant, prepareTrustMarker } from "./engine-trust.ts"
import type { EventLog } from "./event-log.ts"
import type { RunState } from "./fold.ts"
import { materializeRunInput } from "./run-input.ts"
import { shouldQueueRun } from "./run-queue.ts"
import type { ManualFilePart } from "./source-manual.ts"
import type { CliTrustValue } from "@workspace/shared"

export type StartRunParams = {
  workflowDir: string
  runId: string
  trustGrant?: TrustGrant
  values?: Record<string, string>
  files?: ManualFilePart[]
  workItemId?: string
}

export type StartRunResult = {
  runId: string
  runRoot: string
  queued: boolean
  workflowId: string
}

/** Prepare dirs, materialize input, append run_started (DES-021). */
export function appendRunStarted(options: {
  log: EventLog
  graph: Workflow
  params: StartRunParams
  homeRealpath: string
  settings: CliTrustValue | null
  setAlwaysTrust: (value: CliTrustValue) => void
  workflowRuns: RunState[]
}): StartRunResult {
  const { log, graph, params, homeRealpath, settings, setAlwaysTrust } = options
  const needsCli = workflowNeedsAgentCli(graph)

  if (needsCli) {
    applyStartTrustGrant(
      params.trustGrant,
      homeRealpath,
      settings,
      setAlwaysTrust
    )
  }

  const runRoot = prepareRunDirs(params.workflowDir, params.runId, graph)
  const { itemKey, inputHash, files, workItemId } = materializeRunInput(
    params.workflowDir,
    runRoot,
    {
      decls: graph.inputs ?? [],
      values: params.values ?? {},
      files: params.files ?? [],
    },
    params.workItemId
  )

  const queued = shouldQueueRun(graph, options.workflowRuns)
  const trustOnce =
    needsCli && params.trustGrant === "once" ? ("once" as const) : undefined

  const event: EngineEvent = {
    type: "run_started",
    runId: params.runId,
    workflowId: graph.id,
    graph,
    at: new Date().toISOString(),
    source: "manual",
    itemKey,
    inputHash,
    files,
    ...(queued ? { queued: true } : {}),
    ...(trustOnce ? { trustGrant: trustOnce } : {}),
    ...(workItemId !== undefined ? { workItemId } : {}),
  }
  log.append(event)

  if (needsCli) prepareTrustMarker(homeRealpath, params.workflowDir)

  return {
    runId: params.runId,
    runRoot,
    queued,
    workflowId: graph.id,
  }
}

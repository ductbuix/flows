import type { Workflow } from "@workspace/contracts"
import { fold, type PartialRun, type RunActor } from "@workspace/core"
import type {
  Engine,
  ManualItem,
  MaterializeResourcesResult,
} from "@workspace/adapters-node"
import { ensureWorkCopiesFor } from "@workspace/adapters-node"
import { copyPartialInput, seedCorePartial } from "./core-run-partial.ts"
import { prepareCoreRunDir } from "./core-run-prepare.ts"
import type { CoreRunSession } from "./core-run-session.ts"

export type StartCoreRunArgs = {
  graph: Workflow
  runId: string
  pins?: MaterializeResourcesResult
  inputText?: string
  inputs?: ManualItem
  workItemId?: string
  partial?: PartialRun
}

export async function startCoreRun(
  engine: Engine,
  session: CoreRunSession,
  makeActor: (runId: string) => RunActor,
  args: StartCoreRunArgs
): Promise<{ runId: string }> {
  session.trackCap(args.graph)
  const at = new Date().toISOString()
  const queued =
    session.scheduler.admit(args.runId, args.graph.id, at) === "queued"

  const runRoot = prepareCoreRunDir({
    home: engine.home,
    graph: args.graph,
    runId: args.runId,
    inputText: args.partial ? undefined : args.inputText,
    inputs: args.partial ? undefined : args.inputs,
    workItemId: args.workItemId,
  })
  // Asset access:propose → per-connection work copies under work/ (BL-084 / BL-214).
  ensureWorkCopiesFor(runRoot, proposeConnectionIds(args.graph))
  if (args.partial) {
    copyPartialInput({
      home: engine.home,
      workflowId: args.graph.id,
      runId: args.runId,
      bases: args.partial.bases,
    })
  }

  let seed = [...(args.pins?.pulledEvents ?? [])]
  if (args.partial && (args.partial.only || args.partial.from)) {
    seed = [
      ...seed,
      ...seedCorePartial({
        engine,
        graph: args.graph,
        runId: args.runId,
        at,
        partial: args.partial,
      }),
    ]
  }

  const actor = makeActor(args.runId)
  session.attachLive(args.runId, args.graph.id, actor)
  void actor
    .push({
      kind: "start",
      at,
      runId: args.runId,
      graph: args.graph,
      workItemId: args.workItemId,
      queued,
      ...(args.partial?.only ? { only: args.partial.only } : {}),
      ...(args.partial?.from ? { from: args.partial.from } : {}),
      ...(seed.length > 0 ? { seed } : {}),
    })
    .then(() => session.endIfTerminal(args.runId, actor))
    .catch(() => session.endLive(args.runId))
  return { runId: args.runId }
}

export async function retryCoreStep(
  engine: Engine,
  session: CoreRunSession,
  makeActor: (runId: string) => RunActor,
  runId: string,
  nodeId: string
): Promise<boolean> {
  if (session.live.has(runId)) {
    throw new Error(`task ${nodeId} cannot be retried`)
  }
  const stored = engine.eventStore().read(runId)
  if (stored.length === 0) throw new Error(`unknown run ${runId}`)
  let state = null as ReturnType<typeof fold>
  for (const s of stored) state = fold(state, s.event)
  if (!state || state.deleted) throw new Error(`unknown run ${runId}`)
  session.trackCap(state.graph)
  const at = new Date().toISOString()
  session.scheduler.forceRunning(runId, state.workflowId, at)
  const actor = makeActor(runId)
  session.attachLive(runId, state.workflowId, actor)
  await actor.recover()
  await actor.push({ kind: "retry_step", at, nodeId })
  await actor.push({ kind: "wake", at })
  session.endIfTerminal(runId, actor)
  return true
}

/** Connections with Asset access:propose on this graph (BL-084). */
function proposeConnectionIds(graph: Workflow): string[] {
  const ids = new Set<string>()
  for (const node of graph.nodes) {
    if (node.kind !== "asset" || node.access !== "propose") continue
    for (const r of node.resources) ids.add(r.connection)
  }
  return [...ids]
}

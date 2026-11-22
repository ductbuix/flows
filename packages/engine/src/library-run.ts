import type {
  EngineEvent,
  LibraryPullResult,
  ResourcePin,
  NodeWorkflow,
  ResourcesJson,
  WorkItemLink,
  Workflow,
} from "@workspace/shared"
import { readConnection } from "./connections.ts"
import {
  LIBRARY_EVENT_RUN_ID,
  linkRunResources,
  pullEntity,
  readResourcesJson,
  resolveScopeEntity,
} from "./library.ts"
import {
  collectNodePullTargets,
  collectPullTargets,
  pullOneTarget,
  type PullTarget,
} from "./library-run-targets.ts"

export type MaterializeResourcesOptions = {
  home: string
  workflow: Workflow
  runRoot: string
  runId: string
  /** Work item context links pulled with uses (BL-046). */
  workItemLinks?: WorkItemLink[]
  /** Prior run root to copy pins from (rerun without refreshPins). */
  pinFromRunRoot?: string
  refreshPins?: boolean
}

export type MaterializeResourcesResult = {
  resources: ResourcesJson
  pulledEvents: EngineEvent[]
}

/**
 * Resolve entities from task uses and work item links, pull or reuse pins,
 * write resources.json before run_started (BL-043 / BL-046).
 */
export async function materializeRunResources(
  options: MaterializeResourcesOptions
): Promise<MaterializeResourcesResult> {
  const { home, workflow, workItemLinks = [] } = options
  const targets = collectPullTargets(home, workflow, workItemLinks)
  return pinTargets({ ...options, targets })
}

/** Pins the Asset resources of a node run, with the work item's links (BL-082). */
export async function materializeNodeRunResources(options: {
  home: string
  graph: NodeWorkflow
  runRoot: string
  runId: string
  workItemLinks?: WorkItemLink[]
  pinFromRunRoot?: string
  refreshPins?: boolean
}): Promise<MaterializeResourcesResult> {
  const targets = collectNodePullTargets(
    options.home,
    options.graph,
    options.workItemLinks ?? []
  )
  return pinTargets({ ...options, targets })
}

async function pinTargets(
  options: Omit<MaterializeResourcesOptions, "workflow"> & {
    targets: PullTarget[]
  }
): Promise<MaterializeResourcesResult> {
  const { home, runRoot, runId, targets, pinFromRunRoot, refreshPins } = options
  if (targets.length === 0) {
    const empty: ResourcesJson = { v: 1, pins: [], warnings: [] }
    linkRunResources(home, runRoot, empty)
    return { resources: empty, pulledEvents: [] }
  }

  if (pinFromRunRoot && !refreshPins) {
    const prior = readResourcesJson(pinFromRunRoot)
    // Pins missing for a target (a node changed since) mean a fresh pull.
    const covers =
      prior !== undefined &&
      targets.every((t) =>
        prior.pins.some(
          (p) =>
            p.connection === t.connection.id &&
            p.kind === t.kind &&
            p.entityId === t.entityId
        )
      )
    if (prior && prior.pins.length > 0 && covers) {
      const reused: ResourcesJson = { v: 1, pins: prior.pins, warnings: [] }
      linkRunResources(home, runRoot, reused)
      return { resources: reused, pulledEvents: [] }
    }
  }

  const pins: ResourcePin[] = []
  const warnings: string[] = []
  const pulledEvents: EngineEvent[] = []
  const at = new Date().toISOString()
  for (const target of targets) {
    const result = await pullOneTarget(
      home,
      runId,
      at,
      target,
      refreshPins === true
    )
    pins.push(result.pin)
    if (result.event) pulledEvents.push(result.event)
    if (result.warning) warnings.push(result.warning)
  }

  const resources: ResourcesJson = { v: 1, pins, warnings }
  linkRunResources(home, runRoot, resources)
  return { resources, pulledEvents }
}

/** Manual pull for POST /library/pull (BL-043). */
export async function pullNow(options: {
  home: string
  connectionId: string
  kind?: string
  entityId?: string
}): Promise<{ result: LibraryPullResult; event: EngineEvent }> {
  const conn = readConnection(options.home, options.connectionId)
  if (!conn) throw new Error(`unknown connection ${options.connectionId}`)
  const scope = resolveScopeEntity(conn)
  const kind = options.kind ?? scope.kind
  const entityId = options.entityId ?? scope.entityId
  const pulled = await pullEntity({
    home: options.home,
    connection: conn,
    kind,
    entityId,
    title: scope.title,
    force: true,
  })
  return {
    result: {
      connection: conn.id,
      kind,
      entityId,
      revision: pulled.revision,
      title: pulled.title,
      pulledAt: pulled.pulledAt,
    },
    event: {
      type: "library_pulled",
      runId: LIBRARY_EVENT_RUN_ID,
      at: new Date().toISOString(),
      connection: conn.id,
      kind,
      entityId,
      revision: pulled.revision,
      impact: "read",
    },
  }
}

import type {
  EngineEvent,
  LibraryPullResult,
  ResourcePin,
  ResourcesJson,
  Workflow,
} from "@workspace/contracts"
import type { ResourceLink } from "./connection-model.ts"
import { requireConnection } from "./connection-resolve.ts"
import {
  LIBRARY_EVENT_RUN_ID,
  linkRunResources,
  pullEntity,
  readResourcesJson,
  resolveScopeEntity,
} from "./library.ts"
import {
  collectNodePullTargets,
  pullOneTarget,
  type PullTarget,
} from "./library-run-targets.ts"

export type MaterializeResourcesOptions = {
  home: string
  runRoot: string
  runId: string
  /** Card context links pulled with the Asset resources (BL-046). */
  cardLinks?: ResourceLink[]
  /** Prior run root to copy pins from (rerun without refreshPins). */
  pinFromRunRoot?: string
  refreshPins?: boolean
}

export type MaterializeResourcesResult = {
  resources: ResourcesJson
  pulledEvents: EngineEvent[]
}

/** Pins the Asset resources of a node run, with the card's links (BL-082). */
export async function materializeNodeRunResources(options: {
  home: string
  graph: Workflow
  runRoot: string
  runId: string
  cardLinks?: ResourceLink[]
  pinFromRunRoot?: string
  refreshPins?: boolean
}): Promise<MaterializeResourcesResult> {
  const targets = collectNodePullTargets(
    options.home,
    options.graph,
    options.cardLinks ?? []
  )
  return pinTargets({ ...options, targets })
}

async function pinTargets(
  options: MaterializeResourcesOptions & {
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
  const conn = requireConnection(options.home, options.connectionId)
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

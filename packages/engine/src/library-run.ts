import { join } from "node:path"
import type {
  EngineEvent,
  LibraryPullResult,
  ResourcePin,
  ResourcesJson,
  Workflow,
} from "@workspace/shared"
import { collectWorkflowUses, readConnection } from "./connections.ts"
import { currentRevision, readRevisionMeta } from "./library-paths.ts"
import {
  LIBRARY_EVENT_RUN_ID,
  linkRunResources,
  pullEntity,
  readResourcesJson,
  resolveScopeEntity,
} from "./library.ts"
import { libraryEntityDir } from "./paths.ts"

export type MaterializeResourcesOptions = {
  home: string
  workflow: Workflow
  runRoot: string
  runId: string
  /** Prior run root to copy pins from (rerun without refreshPins). */
  pinFromRunRoot?: string
  refreshPins?: boolean
}

export type MaterializeResourcesResult = {
  resources: ResourcesJson
  pulledEvents: EngineEvent[]
}

/**
 * Resolve entities from task uses (scope entity per connection), pull or
 * reuse pins, write resources.json before run_started (BL-043).
 */
export async function materializeRunResources(
  options: MaterializeResourcesOptions
): Promise<MaterializeResourcesResult> {
  const { home, workflow, runRoot, runId, pinFromRunRoot, refreshPins } =
    options
  const uses = collectWorkflowUses(workflow)
  if (uses.length === 0) {
    const empty: ResourcesJson = { v: 1, pins: [], warnings: [] }
    linkRunResources(home, runRoot, empty)
    return { resources: empty, pulledEvents: [] }
  }

  if (pinFromRunRoot && !refreshPins) {
    const prior = readResourcesJson(pinFromRunRoot)
    if (prior && prior.pins.length > 0) {
      const reused: ResourcesJson = { v: 1, pins: prior.pins, warnings: [] }
      linkRunResources(home, runRoot, reused)
      return { resources: reused, pulledEvents: [] }
    }
  }

  const byConn = new Map<
    string,
    ReturnType<typeof resolveScopeEntity> & {
      connection: NonNullable<ReturnType<typeof readConnection>>
    }
  >()
  for (const entry of uses) {
    if (byConn.has(entry.connection)) continue
    const conn = readConnection(home, entry.connection)
    if (!conn) throw new Error(`unknown connection ${entry.connection}`)
    byConn.set(entry.connection, {
      ...resolveScopeEntity(conn),
      connection: conn,
    })
  }

  const pins: ResourcePin[] = []
  const warnings: string[] = []
  const pulledEvents: EngineEvent[] = []
  const at = new Date().toISOString()

  for (const { connection, kind, entityId, title } of byConn.values()) {
    try {
      const pulled = await pullEntity({
        home,
        connection,
        kind,
        entityId,
        title,
        force: refreshPins === true,
      })
      pins.push({
        connection: connection.id,
        kind,
        entityId,
        revision: pulled.revision,
        title: pulled.title,
      })
      if (!pulled.fromCache) {
        pulledEvents.push({
          type: "library_pulled",
          runId,
          at,
          connection: connection.id,
          kind,
          entityId,
          revision: pulled.revision,
          impact: "read",
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const existing = currentRevision(home, connection.id, kind, entityId)
      if (!existing) {
        throw new Error(
          `library pull failed for ${connection.id}/${kind}/${entityId}: ${message}`
        )
      }
      const meta = readRevisionMeta(
        join(libraryEntityDir(home, connection.id, kind, entityId), existing)
      )
      pins.push({
        connection: connection.id,
        kind,
        entityId,
        revision: existing,
        title: meta?.title ?? title,
      })
      warnings.push(
        `pull failed for ${connection.id}/${kind}/${entityId}: ${message}; using revision ${existing}`
      )
    }
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

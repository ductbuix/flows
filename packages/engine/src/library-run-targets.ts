import { join } from "node:path"
import type {
  Connection,
  EngineEvent,
  NodeWorkflow,
  ResourcePin,
  WorkItemLink,
  Workflow,
} from "@workspace/shared"
import { collectWorkflowUses, readConnection } from "./connections.ts"
import { currentRevision, readRevisionMeta } from "./library-paths.ts"
import { pullEntity, resolveScopeEntity } from "./library.ts"
import { libraryEntityDir } from "./paths.ts"

export type PullTarget = {
  connection: Connection
  kind: string
  entityId: string
  title: string
}

function pinKey(connection: string, kind: string, entityId: string): string {
  return `${connection}\0${kind}\0${entityId}`
}

/** Scope entities from uses plus explicit work item links (BL-043 / BL-046). */
export function collectPullTargets(
  home: string,
  workflow: Workflow,
  links: WorkItemLink[]
): PullTarget[] {
  const byKey = new Map<string, PullTarget>()
  for (const entry of collectWorkflowUses(workflow)) {
    const conn = readConnection(home, entry.connection)
    if (!conn) throw new Error(`unknown connection ${entry.connection}`)
    const scope = resolveScopeEntity(conn)
    const key = pinKey(conn.id, scope.kind, scope.entityId)
    if (!byKey.has(key)) {
      byKey.set(key, { connection: conn, ...scope })
    }
  }
  for (const link of links) {
    const key = pinKey(link.connection, link.kind, link.entityId)
    if (byKey.has(key)) continue
    const conn = readConnection(home, link.connection)
    if (!conn) throw new Error(`unknown connection ${link.connection}`)
    byKey.set(key, {
      connection: conn,
      kind: link.kind,
      entityId: link.entityId,
      title: conn.name,
    })
  }
  return [...byKey.values()]
}

/**
 * Node runs (BL-082): every resource of every Asset node, plus the work
 * item's links. Without an Asset node nothing is pinned.
 */
export function collectNodePullTargets(
  home: string,
  graph: NodeWorkflow,
  links: WorkItemLink[]
): PullTarget[] {
  const assets = graph.nodes.filter((n) => n.kind === "asset")
  if (assets.length === 0) return []
  const byKey = new Map<string, PullTarget>()
  const add = (connection: string, kind: string, entityId: string) => {
    const key = pinKey(connection, kind, entityId)
    if (byKey.has(key)) return
    const conn = readConnection(home, connection)
    if (!conn) throw new Error(`unknown connection ${connection}`)
    byKey.set(key, { connection: conn, kind, entityId, title: conn.name })
  }
  for (const node of assets) {
    if (node.kind !== "asset") continue
    for (const r of node.resources) add(r.connection, r.entity, r.id)
  }
  for (const link of links) add(link.connection, link.kind, link.entityId)
  return [...byKey.values()]
}

export async function pullOneTarget(
  home: string,
  runId: string,
  at: string,
  target: PullTarget,
  force: boolean
): Promise<{ pin: ResourcePin; event?: EngineEvent; warning?: string }> {
  const { connection, kind, entityId, title } = target
  try {
    const pulled = await pullEntity({
      home,
      connection,
      kind,
      entityId,
      title,
      force,
    })
    const pin: ResourcePin = {
      connection: connection.id,
      kind,
      entityId,
      revision: pulled.revision,
      title: pulled.title,
    }
    if (pulled.fromCache) return { pin }
    return {
      pin,
      event: {
        type: "library_pulled",
        runId,
        at,
        connection: connection.id,
        kind,
        entityId,
        revision: pulled.revision,
        impact: "read",
      },
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
    return {
      pin: {
        connection: connection.id,
        kind,
        entityId,
        revision: existing,
        title: meta?.title ?? title,
      },
      warning: `pull failed for ${connection.id}/${kind}/${entityId}: ${message}; using revision ${existing}`,
    }
  }
}

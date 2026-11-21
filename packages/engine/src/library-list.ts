import { existsSync, readdirSync, readlinkSync } from "node:fs"
import { join } from "node:path"
import type { LibraryEntity, LibraryList } from "@workspace/shared"
import { readConnection } from "./connections.ts"
import { isFresh, readRevisionMeta } from "./library-paths.ts"
import { readResourcesJson } from "./library.ts"
import { decodeEntityId, libraryDir } from "./paths.ts"

function listPinningRuns(
  home: string,
  connectionId: string,
  kind: string,
  entityId: string,
  revision: string
): string[] {
  const workflowsRoot = join(home, "workflows")
  if (!existsSync(workflowsRoot)) return []
  const ids: string[] = []
  for (const wf of readdirSync(workflowsRoot, { withFileTypes: true })) {
    if (!wf.isDirectory()) continue
    const runsRoot = join(workflowsRoot, wf.name, "runs")
    if (!existsSync(runsRoot)) continue
    for (const run of readdirSync(runsRoot, { withFileTypes: true })) {
      if (!run.isDirectory()) continue
      const res = readResourcesJson(join(runsRoot, run.name))
      if (!res) continue
      const hit = res.pins.some(
        (p) =>
          p.connection === connectionId &&
          p.kind === kind &&
          p.entityId === entityId &&
          p.revision === revision
      )
      if (hit) ids.push(run.name)
    }
  }
  return ids.sort()
}

/** GET /library: entities, revisions, freshness, pinning runs. */
export function listLibrary(home: string): LibraryList {
  const root = libraryDir(home)
  const entities: LibraryEntity[] = []
  if (!existsSync(root)) return { entities }

  for (const connEntry of readdirSync(root, { withFileTypes: true })) {
    if (!connEntry.isDirectory()) continue
    const connectionId = connEntry.name
    const conn = readConnection(home, connectionId)
    const connRoot = join(root, connectionId)
    for (const kindEntry of readdirSync(connRoot, { withFileTypes: true })) {
      if (!kindEntry.isDirectory()) continue
      const kind = kindEntry.name
      const kindRoot = join(connRoot, kind)
      for (const ent of readdirSync(kindRoot, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue
        const entityId = decodeEntityId(ent.name)
        const entityRoot = join(kindRoot, ent.name)
        const currentLink = join(entityRoot, "current")
        const current = existsSync(currentLink)
          ? readlinkSync(currentLink)
          : undefined
        const revisions = []
        for (const rev of readdirSync(entityRoot, { withFileTypes: true })) {
          if (!rev.isDirectory() || rev.name.startsWith(".")) continue
          const meta = readRevisionMeta(join(entityRoot, rev.name))
          if (!meta) continue
          revisions.push({
            revision: rev.name,
            pulledAt: meta.pulledAt,
            title: meta.title,
            current: rev.name === current,
            pinningRunIds: listPinningRuns(
              home,
              connectionId,
              kind,
              entityId,
              rev.name
            ),
          })
        }
        revisions.sort((a, b) => b.pulledAt.localeCompare(a.pulledAt))
        const currentMeta = current
          ? readRevisionMeta(join(entityRoot, current))
          : undefined
        const refresh = conn?.refresh ?? "never"
        entities.push({
          connection: connectionId,
          kind,
          entityId,
          title: currentMeta?.title ?? conn?.name ?? entityId,
          refresh,
          pulledAt: currentMeta?.pulledAt,
          fresh: isFresh(currentMeta?.pulledAt, refresh),
          revisions,
        })
      }
    }
  }

  entities.sort((a, b) =>
    `${a.connection}/${a.kind}/${a.entityId}`.localeCompare(
      `${b.connection}/${b.kind}/${b.entityId}`
    )
  )
  return { entities }
}

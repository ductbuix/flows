import { execFile } from "node:child_process"
import { existsSync, readdirSync, readlinkSync, rmSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"
import type { LibraryClearResult } from "@workspace/contracts"
import { readRevisionMeta } from "./library-paths.ts"
import { pinKey, pinnedRevisionKeys } from "./library-pins.ts"
import { decodeEntityId, libraryDir, libraryEntityDir } from "./paths.ts"

const execFileAsync = promisify(execFile)

/** Shared repo clone dir under an entity (matches github SHARED_CLONE). */
const SHARED_CLONE = ".clone"

/** Unpinned revisions older than this are swept (DES-026). */
export const LIBRARY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export const LIBRARY_RETENTION_INTERVAL_MS = 60 * 60 * 1000

export type SweepOptions = {
  now?: number
  maxAgeMs?: number
  /** Live run ids that may hold work copies (block git gc). */
  liveRunIds?: Iterable<string>
}

export type SweepResult = {
  removed: string[]
  gcRepos: string[]
}

type EntityRef = {
  connectionId: string
  kind: string
  entityId: string
  entityRoot: string
}

function walkEntities(home: string): EntityRef[] {
  const root = libraryDir(home)
  if (!existsSync(root)) return []
  const out: EntityRef[] = []
  for (const conn of readdirSync(root, { withFileTypes: true })) {
    if (!conn.isDirectory()) continue
    const connRoot = join(root, conn.name)
    for (const kind of readdirSync(connRoot, { withFileTypes: true })) {
      if (!kind.isDirectory()) continue
      const kindRoot = join(connRoot, kind.name)
      for (const ent of readdirSync(kindRoot, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue
        out.push({
          connectionId: conn.name,
          kind: kind.name,
          entityId: decodeEntityId(ent.name),
          entityRoot: join(kindRoot, ent.name),
        })
      }
    }
  }
  return out
}

function currentOf(entityRoot: string): string | undefined {
  const link = join(entityRoot, "current")
  if (!existsSync(link)) return undefined
  try {
    return readlinkSync(link)
  } catch {
    return undefined
  }
}

function revisionDirs(entityRoot: string): string[] {
  return readdirSync(entityRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
}

/** Remove unpinned, non-current revisions older than the retention age. */
export async function sweepLibrary(
  home: string,
  options: SweepOptions = {}
): Promise<SweepResult> {
  const now = options.now ?? Date.now()
  const maxAgeMs = options.maxAgeMs ?? LIBRARY_RETENTION_MS
  const pinned = pinnedRevisionKeys(home)
  const removed: string[] = []

  for (const ent of walkEntities(home)) {
    const current = currentOf(ent.entityRoot)
    for (const rev of revisionDirs(ent.entityRoot)) {
      if (rev === current) continue
      const key = pinKey({
        connection: ent.connectionId,
        kind: ent.kind,
        entityId: ent.entityId,
        revision: rev,
      })
      if (pinned.has(key)) continue
      const meta = readRevisionMeta(join(ent.entityRoot, rev))
      const pulledAt = meta ? Date.parse(meta.pulledAt) : NaN
      if (Number.isNaN(pulledAt) || now - pulledAt < maxAgeMs) continue
      rmSync(join(ent.entityRoot, rev), { recursive: true, force: true })
      removed.push(`${ent.connectionId}/${ent.kind}/${ent.entityId}@${rev}`)
    }
  }

  const gcRepos = await pruneIdleClonesAsync(home, options.liveRunIds ?? [])
  return { removed, gcRepos }
}

/**
 * Remove unpinned, non-current revisions for one entity (any age).
 * Never touches work items or current.
 */
export function clearEntityRevisions(
  home: string,
  connectionId: string,
  kind: string,
  entityId: string
): LibraryClearResult {
  const root = libraryEntityDir(home, connectionId, kind, entityId)
  if (!existsSync(root)) {
    return { connection: connectionId, kind, entityId, removed: [] }
  }
  const pinned = pinnedRevisionKeys(home)
  const current = currentOf(root)
  const removed: string[] = []
  for (const rev of revisionDirs(root)) {
    if (rev === current) continue
    const key = pinKey({
      connection: connectionId,
      kind,
      entityId,
      revision: rev,
    })
    if (pinned.has(key)) continue
    rmSync(join(root, rev), { recursive: true, force: true })
    removed.push(rev)
  }
  return { connection: connectionId, kind, entityId, removed }
}

/** True when a live run has work/<connectionId> under its run dir. */
export function connectionHasLiveWorkCopy(
  home: string,
  connectionId: string,
  liveRunIds: Set<string>
): boolean {
  if (liveRunIds.size === 0) return false
  const workflowsRoot = join(home, "workflows")
  if (!existsSync(workflowsRoot)) return false
  for (const wf of readdirSync(workflowsRoot, { withFileTypes: true })) {
    if (!wf.isDirectory()) continue
    const runsRoot = join(workflowsRoot, wf.name, "runs")
    if (!existsSync(runsRoot)) continue
    for (const run of readdirSync(runsRoot, { withFileTypes: true })) {
      if (!run.isDirectory() || !liveRunIds.has(run.name)) continue
      const work = join(runsRoot, run.name, "work", connectionId)
      if (existsSync(work)) return true
    }
  }
  return false
}

/** Run git gc --prune on shared clones with no live work copy. */
export async function pruneIdleClonesAsync(
  home: string,
  liveRunIds: Iterable<string>
): Promise<string[]> {
  const live = new Set(liveRunIds)
  const done: string[] = []
  for (const ent of walkEntities(home)) {
    const cloneDir = join(ent.entityRoot, SHARED_CLONE)
    if (!existsSync(cloneDir)) continue
    if (connectionHasLiveWorkCopy(home, ent.connectionId, live)) continue
    try {
      await execFileAsync("git", ["-C", cloneDir, "config", "gc.auto", "0"])
      await execFileAsync("git", ["-C", cloneDir, "gc", "--prune=now"])
      done.push(cloneDir)
    } catch {
      // Best-effort; a bad clone must not fail the age sweep.
    }
  }
  return done
}

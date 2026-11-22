import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join } from "node:path"
import type {
  ChangeSet,
  EngineEvent,
  ResourcesJson,
  Task,
} from "@workspace/shared"
import { readConnection } from "./connections.ts"
import { getConnector } from "./connectors/registry.ts"
import { entityIdSegment } from "./library-paths.ts"
import { readResourcesJson } from "./library.ts"

/** Run-relative work copy root for a connection (DES-026). */
export function workConnectionDir(
  runRoot: string,
  connectionId: string
): string {
  return join(runRoot, "work", connectionId)
}

export function workEntityDir(
  runRoot: string,
  connectionId: string,
  kind: string,
  entityId: string
): string {
  return join(
    workConnectionDir(runRoot, connectionId),
    kind,
    entityIdSegment(entityId)
  )
}

function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"))
}

/** Keep library clones from GC while work copies may reference them. */
export function ensureLibraryGcAutoOff(repoDir: string): void {
  if (!isGitRepo(repoDir)) return
  execFileSync("git", ["-C", repoDir, "config", "gc.auto", "0"], {
    stdio: "ignore",
  })
}

/**
 * Copy a pinned revision into the work tree. Repos use
 * `git clone --shared`; others use `cp -cR` with a plain copy fallback.
 */
export function copyPinnedEntity(src: string, dest: string): void {
  if (existsSync(dest)) return
  mkdirSync(dirname(dest), { recursive: true })
  if (isGitRepo(src)) {
    ensureLibraryGcAutoOff(src)
    execFileSync("git", ["clone", "--shared", src, dest], { stdio: "ignore" })
    return
  }
  try {
    execFileSync("cp", ["-cR", src, dest], { stdio: "ignore" })
  } catch {
    cpSync(src, dest, { recursive: true })
  }
}

function resolvePinSource(
  runRoot: string,
  pin: ResourcesJson["pins"][number]
): string {
  const link = join(
    runRoot,
    "resources",
    pin.connection,
    pin.kind,
    entityIdSegment(pin.entityId)
  )
  if (!existsSync(link)) {
    throw new Error(
      `missing resource pin ${pin.connection}/${pin.kind}/${pin.entityId}`
    )
  }
  try {
    return realpathSync(link)
  } catch {
    return readlinkSync(link)
  }
}

/**
 * Create work copies for every propose connection on the task. Later
 * propose tasks on the same connection reuse the existing tree.
 */
export function ensureWorkCopies(runRoot: string, task: Task): void {
  ensureWorkCopiesFor(
    runRoot,
    (task.uses ?? [])
      .filter((u) => u.access === "propose")
      .map((u) => u.connection)
  )
}

/** Work copies for the named connections; a copy that exists is kept (BL-084). */
export function ensureWorkCopiesFor(
  runRoot: string,
  connectionIds: Iterable<string>
): void {
  const resources = readResourcesJson(runRoot)
  if (!resources) return
  const proposeIds = new Set(connectionIds)
  if (proposeIds.size === 0) return

  for (const connectionId of proposeIds) {
    const pins = resources.pins.filter((p) => p.connection === connectionId)
    for (const pin of pins) {
      const dest = workEntityDir(
        runRoot,
        pin.connection,
        pin.kind,
        pin.entityId
      )
      if (existsSync(dest)) continue
      const src = resolvePinSource(runRoot, pin)
      copyPinnedEntity(src, dest)
    }
  }
}

export function previewFromChangeSet(changeSet: ChangeSet): string {
  if (changeSet.ops.length === 0) {
    return `# Changes for ${changeSet.connection}\n\nNo changes.\n`
  }
  const lines = [
    `# Changes for ${changeSet.connection}`,
    "",
    `Base: ${changeSet.base}`,
    "",
  ]
  for (const op of changeSet.ops) {
    const flag = op.destructive ? " (destructive)" : ""
    lines.push(`- **${op.op}** \`${op.target}\`${flag}: ${op.summary}`)
  }
  lines.push("")
  return lines.join("\n")
}

export function changesDir(runRoot: string, connectionId: string): string {
  return join(runRoot, "changes", connectionId)
}

/** Publish task change set folder (DES-026 / BL-049). */
export function publishChangesDir(runRoot: string, taskId: string): string {
  return join(runRoot, "changes", taskId)
}

/**
 * Snapshot of the last published work copy; lives beside `work/` so
 * connector diffs do not walk it (DES-026 / BL-049).
 */
export function workPublishBaseDir(
  runRoot: string,
  connectionId: string
): string {
  return join(runRoot, "publish-base", connectionId)
}

function resolveDiffBaseDir(runRoot: string, connectionId: string): string {
  const published = workPublishBaseDir(runRoot, connectionId)
  if (existsSync(published)) return published
  return join(runRoot, "resources", connectionId)
}

/**
 * After a successful publish, move the work copy's base to the published
 * state so a later publish task only sends newer changes (DES-026).
 */
export function advanceWorkCopyBase(
  runRoot: string,
  connectionId: string
): void {
  const workRoot = workConnectionDir(runRoot, connectionId)
  if (!existsSync(workRoot)) return
  const base = workPublishBaseDir(runRoot, connectionId)
  rmSync(base, { recursive: true, force: true })
  mkdirSync(dirname(base), { recursive: true })
  try {
    execFileSync("cp", ["-cR", workRoot, base], { stdio: "ignore" })
  } catch {
    cpSync(workRoot, base, { recursive: true })
  }
}

/** Diff a connection's work copy against its pinned or published base. */
export async function diffWorkCopy(options: {
  home: string
  runRoot: string
  connectionId: string
  /** When set, write changeset/preview under changes/<taskId>/ (BL-049). */
  publishTaskId?: string
  runId?: string
}): Promise<{ changeSet: ChangeSet; previewMd: string }> {
  const { home, runRoot, connectionId, publishTaskId } = options
  const runId = options.runId ?? basename(runRoot)
  const conn = readConnection(home, connectionId)
  if (!conn) throw new Error(`unknown connection ${connectionId}`)
  const connector = getConnector(conn.connector)
  if (!connector) throw new Error(`unknown connector ${conn.connector}`)

  const workRoot = workConnectionDir(runRoot, connectionId)
  if (!existsSync(workRoot)) {
    const empty: ChangeSet = {
      v: 1,
      connection: connectionId,
      base: "none",
      ops: [],
    }
    return { changeSet: empty, previewMd: previewFromChangeSet(empty) }
  }

  const baseRoot = resolveDiffBaseDir(runRoot, connectionId)
  const raw = await connector.diff({
    connection: conn,
    workCopyDir: workRoot,
    baseDir: baseRoot,
    runId,
    publishTaskId,
  })
  const changeSet = raw as ChangeSet
  const previewMd = previewFromChangeSet(changeSet)
  const out = publishTaskId
    ? publishChangesDir(runRoot, publishTaskId)
    : changesDir(runRoot, connectionId)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, "changeset.json"), JSON.stringify(changeSet, null, 2))
  writeFileSync(join(out, "preview.md"), previewMd)
  return { changeSet, previewMd }
}

/** Connections that have a work/ tree on this run. */
export function listWorkConnections(runRoot: string): string[] {
  const root = join(runRoot, "work")
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

/**
 * At run end, record a Local effect for each work copy with unpublished
 * changes (DES-026 / BL-048). Diff uses the advanced base after publish,
 * so only unsent ops remain.
 */
export async function recordUnpublishedLocalEffects(options: {
  home: string
  runRoot: string
  runId: string
  append: (event: EngineEvent) => void
}): Promise<void> {
  const { home, runRoot, runId, append } = options
  for (const connectionId of listWorkConnections(runRoot)) {
    try {
      const { changeSet } = await diffWorkCopy({
        home,
        runRoot,
        connectionId,
        runId,
      })
      if (changeSet.ops.length === 0) continue
      append({
        type: "work_copy_changed",
        runId,
        connection: connectionId,
        impact: "local",
        opCount: changeSet.ops.length,
        destructive: changeSet.ops.some((o) => o.destructive),
        at: new Date().toISOString(),
      })
    } catch {
      /* skip connections that fail to diff */
    }
  }
}

/** Remove work copies under a run (also covered by full run dir delete). */
export function removeWorkCopies(runRoot: string): void {
  const root = join(runRoot, "work")
  if (existsSync(root)) rmSync(root, { recursive: true, force: true })
}

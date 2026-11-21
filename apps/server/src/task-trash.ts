import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
} from "node:fs"
import { basename, join } from "node:path"
import { isLiveRunStatus, type Engine } from "@workspace/engine"
import { isSafeTaskId } from "@workspace/shared"

/** UTC stamp for trash folder names: `YYYYMMDDTHHMMSSZ` (DES-022). */
export function trashStamp(at: Date = new Date()): string {
  return at
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z")
}

/** Unique `tasks/.trash/<id>-<stamp>/` path; appends `-1`, `-2`, … on clash. */
export function uniqueTrashDir(
  tasksRoot: string,
  taskId: string,
  stamp: string
): string {
  const trashRoot = join(tasksRoot, ".trash")
  let name = `${taskId}-${stamp}`
  let n = 0
  while (existsSync(join(trashRoot, name))) {
    n += 1
    name = `${taskId}-${stamp}-${n}`
  }
  return join(trashRoot, name)
}

export type LiveTaskConflict = {
  taskIds: string[]
  runIds: string[]
}

/**
 * Removed authored task ids that still appear in a live or queued run's
 * frozen graph (no `promptDir`).
 */
export function findLiveTaskConflict(
  engine: Engine,
  workflowId: string,
  removedIds: string[]
): LiveTaskConflict | null {
  if (removedIds.length === 0) return null
  const removed = new Set(removedIds)
  const hitTasks = new Set<string>()
  const hitRuns = new Set<string>()
  for (const run of engine.listRunsForWorkflow(workflowId)) {
    if (!isLiveRunStatus(run.status)) continue
    for (const task of run.graph.tasks) {
      if (!removed.has(task.id) || task.promptDir) continue
      hitTasks.add(task.id)
      hitRuns.add(run.runId)
    }
  }
  if (hitTasks.size === 0) return null
  return {
    taskIds: [...hitTasks].sort(),
    runIds: [...hitRuns].sort(),
  }
}

/** Task folder names under `tasks/` that are not in `keptIds` (retry). */
export function orphanTaskFolderIds(
  tasksRoot: string,
  keptIds: ReadonlySet<string>
): string[] {
  if (!existsSync(tasksRoot)) return []
  const out: string[] = []
  for (const name of readdirSync(tasksRoot)) {
    if (name === ".trash" || keptIds.has(name) || !isSafeTaskId(name)) continue
    const abs = join(tasksRoot, name)
    if (statSync(abs).isDirectory()) out.push(name)
  }
  return out
}

export type TrashMoveFailure = { path: string }

/**
 * Move removed task folders and leftover `need-<id>.md` files into
 * `tasks/.trash/<id>-<stamp>/`. Missing sources are skipped.
 */
export function moveRemovedTasksToTrash(
  workflowRoot: string,
  removedIds: string[],
  stamp: string = trashStamp()
): TrashMoveFailure | null {
  if (removedIds.length === 0) return null
  const tasksRoot = join(workflowRoot, "tasks")
  for (const taskId of removedIds) {
    const fail = trashOneTask(tasksRoot, taskId, stamp)
    if (fail) return fail
  }
  return null
}

function trashOneTask(
  tasksRoot: string,
  taskId: string,
  stamp: string
): TrashMoveFailure | null {
  const source = join(tasksRoot, taskId)
  const needFiles = findLeftoverNeedFiles(tasksRoot, taskId)
  const hasFolder = existsSync(source) && statSync(source).isDirectory()
  if (!hasFolder && needFiles.length === 0) return null

  const dest = uniqueTrashDir(tasksRoot, taskId, stamp)
  const rel = `tasks/.trash/${basename(dest)}`
  try {
    mkdirSync(join(tasksRoot, ".trash"), { recursive: true })
    if (hasFolder) {
      renameSync(source, dest)
    } else {
      mkdirSync(dest, { recursive: true })
    }
    for (const need of needFiles) {
      const fromDir = join(dest, "from", need.dependentId)
      mkdirSync(fromDir, { recursive: true })
      renameSync(need.abs, join(fromDir, `need-${taskId}.md`))
    }
  } catch {
    return { path: `${rel}/` }
  }
  return null
}

type LeftoverNeed = { dependentId: string; abs: string }

function findLeftoverNeedFiles(
  tasksRoot: string,
  removedId: string
): LeftoverNeed[] {
  if (!existsSync(tasksRoot)) return []
  const needle = `need-${removedId}.md`
  const out: LeftoverNeed[] = []
  for (const name of readdirSync(tasksRoot)) {
    if (name === ".trash" || name === removedId || !isSafeTaskId(name)) continue
    const abs = join(tasksRoot, name, needle)
    if (existsSync(abs) && statSync(abs).isFile()) {
      out.push({ dependentId: name, abs })
    }
  }
  return out
}

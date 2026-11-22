import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { isSafeTaskId } from "@workspace/shared"

/** UTC stamp for trash folder names: `YYYYMMDDTHHMMSSZ` (DES-022). */
export function trashStamp(at: Date = new Date()): string {
  return at
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z")
}

/** Unique `<root>/.trash/<id>-<stamp>/` path; appends `-1`, `-2`, … on clash. */
export function uniqueTrashDir(
  nodesRoot: string,
  nodeId: string,
  stamp: string
): string {
  const trashRoot = join(nodesRoot, ".trash")
  let name = `${nodeId}-${stamp}`
  let n = 0
  while (existsSync(join(trashRoot, name))) {
    n += 1
    name = `${nodeId}-${stamp}-${n}`
  }
  return join(trashRoot, name)
}

/** Node folder names under `nodes/` that are not in `keptIds` (retry). */
export function orphanNodeFolderIds(
  nodesRoot: string,
  keptIds: ReadonlySet<string>
): string[] {
  if (!existsSync(nodesRoot)) return []
  const out: string[] = []
  for (const name of readdirSync(nodesRoot)) {
    if (name === ".trash" || keptIds.has(name) || !isSafeTaskId(name)) continue
    const abs = join(nodesRoot, name)
    if (statSync(abs).isDirectory()) out.push(name)
  }
  return out
}

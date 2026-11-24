import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ChangeSet, EngineEvent } from "@workspace/contracts"
import { publishChangesDir } from "./work-copy.ts"

export function readStoredChangeSet(
  runRoot: string,
  taskId: string
): ChangeSet | null {
  const path = join(publishChangesDir(runRoot, taskId), "changeset.json")
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ChangeSet
  } catch {
    return null
  }
}

/** True when publish_started has no matching publish_finished. */
export function hasOpenPublish(events: EngineEvent[], taskId: string): boolean {
  let open = false
  for (const e of events) {
    if (e.type === "publish_started" && e.taskId === taskId) open = true
    if (e.type === "publish_finished" && e.taskId === taskId) open = false
  }
  return open
}

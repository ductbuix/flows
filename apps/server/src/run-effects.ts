import type { EngineEvent, RunEffect } from "@workspace/shared"

function resultLabel(
  result: Record<string, unknown> | undefined
): string | undefined {
  if (!result) return undefined
  const url = result.url
  if (typeof url === "string" && url.length > 0) return url
  try {
    return JSON.stringify(result)
  } catch {
    return undefined
  }
}

/** Fold effect events into the run ledger rows (DES-026 / BL-051). */
export function effectsFromEvents(events: EngineEvent[]): RunEffect[] {
  const rows: RunEffect[] = []
  for (const event of events) {
    if (event.type === "library_pulled") {
      rows.push({
        what: `Pulled ${event.kind}/${event.entityId}@${event.revision}`,
        connection: event.connection,
        impact: "read",
      })
      continue
    }
    if (event.type === "work_copy_changed") {
      rows.push({
        what: `Unpublished local changes (${event.opCount} ops)`,
        connection: event.connection,
        impact: "local",
      })
      continue
    }
    if (event.type === "publish_finished" && event.status === "applied") {
      rows.push({
        what: `Published via ${event.taskId}`,
        connection: event.connection,
        impact: "cloud",
        ...(resultLabel(event.result)
          ? { result: resultLabel(event.result) }
          : {}),
        ...(event.undoNote ? { undoNote: event.undoNote } : {}),
      })
    }
  }
  return rows
}

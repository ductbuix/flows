import { join } from "node:path"
import {
  isFresh,
  libraryEntityDir,
  readConnection,
  readResourcesJson,
  readRevisionMeta,
  runDir,
  workflowDir,
  type Engine,
} from "@workspace/engine"
import type { RunLibraryPin, Workflow } from "@workspace/shared"

/** Asset nodes that list a resource of this connection. */
function usedByTaskIds(graph: Workflow, connectionId: string): string[] {
  return graph.nodes
    .filter(
      (n) =>
        n.kind === "asset" &&
        n.resources.some((r) => r.connection === connectionId)
    )
    .map((n) => n.id)
}

/** Build Library pin rows for the run view (BL-046). */
export function buildRunPins(
  engine: Engine,
  workflowId: string,
  runId: string,
  graph: Workflow
): RunLibraryPin[] {
  const root = runDir(workflowDir(engine.home, workflowId), runId)
  const resources = readResourcesJson(root)
  if (!resources) return []
  return resources.pins.map((pin) => {
    const conn = readConnection(engine.home, pin.connection)
    const meta = readRevisionMeta(
      join(
        libraryEntityDir(engine.home, pin.connection, pin.kind, pin.entityId),
        pin.revision
      )
    )
    const fresh = isFresh(meta?.pulledAt, conn?.refresh ?? "never")
    return {
      connection: pin.connection,
      kind: pin.kind,
      entityId: pin.entityId,
      revision: pin.revision,
      title: pin.title,
      fresh,
      usedByTaskIds: usedByTaskIds(graph, pin.connection),
    }
  })
}

import type { Workflow } from "@workspace/contracts"
import { requireConnection } from "../connection-resolve.ts"

/** Fails a start when a publish Output names an unknown or read-only connection. */
export function assertNodePublishValid(home: string, graph: Workflow): void {
  for (const n of graph.nodes) {
    if (n.kind !== "output" || n.target !== "publish") continue
    if (!n.connection) {
      throw new Error(`publish node ${n.id} is missing a connection`)
    }
    const conn = requireConnection(home, n.connection)
    if (conn.policy === "read-only") {
      throw new Error(
        `publish node ${n.id} cannot use read-only connection ${n.connection}`
      )
    }
  }
}

import type { Workflow } from "@workspace/contracts"
import { readConnection } from "../connections.ts"

/** Fails a start when a publish Output names an unknown or read-only connection. */
export function assertNodePublishValid(home: string, graph: Workflow): void {
  for (const n of graph.nodes) {
    if (n.kind !== "output" || n.target !== "publish") continue
    const conn = n.connection ? readConnection(home, n.connection) : null
    if (!conn) {
      throw new Error(
        `publish node ${n.id} references unknown connection ${n.connection}`
      )
    }
    if (conn.policy === "read-only") {
      throw new Error(
        `publish node ${n.id} cannot use read-only connection ${n.connection}`
      )
    }
  }
}

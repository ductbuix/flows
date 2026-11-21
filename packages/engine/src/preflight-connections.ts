import type { TrustCheck, Workflow } from "@workspace/shared"
import { collectWorkflowUses, readConnection } from "./connections.ts"
import { getConnector } from "./connectors/registry.ts"

/**
 * Warn-only connection checks (DES-026 / BL-042): unknown connection,
 * propose access (not built yet), and ambient login from the connector.
 */
export async function checkConnectionUses(input: {
  home: string
  workflow: Workflow
}): Promise<TrustCheck[]> {
  const uses = collectWorkflowUses(input.workflow)
  if (uses.length === 0) return []

  const checks: TrustCheck[] = []
  const seenUnknown = new Set<string>()
  const seenPropose = new Set<string>()
  const seenAmbient = new Set<string>()

  for (const entry of uses) {
    const conn = readConnection(input.home, entry.connection)
    if (!conn) {
      if (!seenUnknown.has(entry.connection)) {
        seenUnknown.add(entry.connection)
        checks.push({
          id: `connection_unknown_${entry.connection}`,
          status: "warn",
          message: `Unknown connection ${entry.connection}`,
        })
      }
      continue
    }

    if (entry.access === "propose" && !seenPropose.has(entry.connection)) {
      seenPropose.add(entry.connection)
      checks.push({
        id: `connection_propose_${entry.connection}`,
        status: "warn",
        message: `propose access on ${entry.connection} is not built yet`,
      })
    }

    const connector = getConnector(conn.connector)
    if (!connector) {
      checks.push({
        id: `connection_connector_${entry.connection}`,
        status: "warn",
        message: `Unknown connector ${conn.connector} for ${entry.connection}`,
      })
      continue
    }

    const result = await connector.check(conn, input.home)
    if (result.ambientLogin && !seenAmbient.has(entry.connection)) {
      seenAmbient.add(entry.connection)
      checks.push({
        id: `connection_ambient_${entry.connection}`,
        status: "warn",
        message: `Ambient login for ${entry.connection}: ${result.ambientLogin}`,
      })
    }
  }

  if (checks.length === 0) {
    return [
      {
        id: "connections",
        status: "pass",
        message: "Connection uses resolve",
      },
    ]
  }
  return checks
}

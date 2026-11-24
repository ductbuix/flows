import type { Connector } from "./types.ts"

const connectors = new Map<string, Connector>()

/** Register an in-repo connector. Replaces an existing id. */
export function registerConnector(connector: Connector): void {
  connectors.set(connector.id, connector)
}

/** Remove a connector (tests). */
export function unregisterConnector(id: string): void {
  connectors.delete(id)
}

export function getConnector(id: string): Connector | undefined {
  return connectors.get(id)
}

export function listConnectors(): Connector[] {
  return [...connectors.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Clear the registry (tests). */
export function clearConnectors(): void {
  connectors.clear()
}

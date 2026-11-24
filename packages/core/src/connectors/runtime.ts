import { engineError } from "../kernel/engine-error.ts"
import { isCapabilityAllowed } from "./capabilities.ts"
import type { ConnectorTransportRegistry } from "./registry.ts"
import type { ConnectorService } from "./service.ts"
import type { ConnectorCallResult, ConnectorCheckResult } from "./transport.ts"

export type ConnectorRuntimeDeps = {
  connectors: ConnectorService
  transports: ConnectorTransportRegistry
}

/**
 * ConnectorRuntime port face (DES-041): capability gate, then the registered
 * transport for the connector's kind.
 */
export class ConnectorRuntime {
  constructor(private readonly deps: ConnectorRuntimeDeps) {}

  async call(
    connectorId: string,
    capability: string,
    args: readonly string[],
    signal: AbortSignal
  ): Promise<ConnectorCallResult> {
    const record = this.requireConnector(connectorId)
    const cap = record.connector.capabilities.find((c) => c.name === capability)
    if (!cap) {
      throw engineError("not_found", `Capability not found: ${capability}`)
    }
    if (!isCapabilityAllowed(record.connector, capability)) {
      throw engineError("policy_denied", `Capability is off: ${capability}`)
    }
    const transport = this.deps.transports.get(record.connector.transport)
    if (!transport) {
      throw engineError(
        "unsupported",
        `No transport registered for "${record.connector.transport}"`
      )
    }
    return transport.call(record.connector, cap, args, signal)
  }

  async check(
    connectorId: string,
    signal: AbortSignal
  ): Promise<ConnectorCheckResult> {
    const record = this.requireConnector(connectorId)
    const transport = this.deps.transports.get(record.connector.transport)
    if (!transport) {
      throw engineError(
        "unsupported",
        `No transport registered for "${record.connector.transport}"`
      )
    }
    if (!transport.check) {
      return { ok: true }
    }
    return transport.check(record.connector, signal)
  }

  private requireConnector(id: string) {
    const record = this.deps.connectors.get(id)
    if (!record) {
      throw engineError("not_found", `Connector not found: ${id}`)
    }
    return record
  }
}

export function createConnectorRuntime(
  deps: ConnectorRuntimeDeps
): ConnectorRuntime {
  return new ConnectorRuntime(deps)
}

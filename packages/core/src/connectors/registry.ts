import type { ConnectorTransport } from "@workspace/contracts"
import type { ConnectorTransportHandler } from "./transport.ts"

/** Registry of ConnectorTransportHandler strategies (DES-041 plugins). */
export class ConnectorTransportRegistry {
  private readonly byKind = new Map<
    ConnectorTransport,
    ConnectorTransportHandler
  >()

  register(handler: ConnectorTransportHandler): this {
    this.byKind.set(handler.kind, handler)
    return this
  }

  get(kind: ConnectorTransport): ConnectorTransportHandler | undefined {
    return this.byKind.get(kind)
  }

  kinds(): ConnectorTransport[] {
    return [...this.byKind.keys()]
  }
}

export function createConnectorTransportRegistry(
  handlers: readonly ConnectorTransportHandler[] = []
): ConnectorTransportRegistry {
  const registry = new ConnectorTransportRegistry()
  for (const h of handlers) registry.register(h)
  return registry
}

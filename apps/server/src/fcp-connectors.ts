import {
  createNodeApiTransport,
  createNodeCliTransport,
  createNodeDocumentStore,
} from "@workspace/adapters-node"
import type { ConnectorFile } from "@workspace/contracts"
import {
  createConnectorBindings,
  createConnectorRuntime,
  createConnectorService,
  createConnectorTransportRegistry,
  type Clock,
  type ConnectorBindings,
  type InboxService,
  type UpdateBus,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"

const systemClock: Clock = { now: () => Date.now() }

/** Connector CRUD + check bindings for `connectors/<id>.yaml` (BL-160 / BL-164). */
export function createConnectorsFcp(
  engine: Engine,
  bus: UpdateBus,
  inbox: InboxService
): ConnectorBindings {
  const docs = createNodeDocumentStore({ root: engine.home })
  const service = createConnectorService({ docs })

  const markExpired = (connector: ConnectorFile, detail: string) => {
    const at = new Date(systemClock.now()).toISOString()
    service.setStatus(connector.id, {
      status: "expired",
      checkedAt: at,
      detail,
    })
    bus.publish("connector/update", {
      kind: "status_changed",
      connectorId: connector.id,
      status: "expired",
      checkedAt: at,
      detail,
    })
    inbox.applyConnectorStatus({
      connectorId: connector.id,
      name: connector.name,
      status: "expired",
      at,
    })
  }

  const transports = createConnectorTransportRegistry([
    createNodeCliTransport(),
    createNodeApiTransport({ home: engine.home, onUnauthorized: markExpired }),
  ])
  const runtime = createConnectorRuntime({ connectors: service, transports })
  return createConnectorBindings(service, {
    check: {
      runtime,
      bus,
      clock: systemClock,
      onStatusChanged: (change) => inbox.applyConnectorStatus(change),
    },
  })
}

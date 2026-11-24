import {
  createNodeCliTransport,
  createNodeDocumentStore,
} from "@workspace/adapters-node"
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
  const transports = createConnectorTransportRegistry([
    createNodeCliTransport(),
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

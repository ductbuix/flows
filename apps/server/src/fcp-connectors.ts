import { createNodeDocumentStore } from "@workspace/adapters-node"
import {
  createConnectorBindings,
  createConnectorService,
  type ConnectorBindings,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"

/** Connector CRUD bindings for `connectors/<id>.yaml` under FLOWAPP_HOME. */
export function createConnectorsFcp(engine: Engine): ConnectorBindings {
  const docs = createNodeDocumentStore({ root: engine.home })
  const service = createConnectorService({ docs })
  return createConnectorBindings(service)
}

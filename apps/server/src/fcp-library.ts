import {
  createNodeCliTransport,
  createNodeDocumentStore,
} from "@workspace/adapters-node"
import {
  createConnectorLibraryFetcher,
  createConnectorRuntime,
  createConnectorService,
  createConnectorTransportRegistry,
  createLibraryBindings,
  createLibraryService,
  createProviderService,
  type Clock,
  type Ids,
  type LibraryBindings,
  type UpdateBus,
} from "@workspace/core"
import type { Host } from "@workspace/adapters-node"
import { randomUUID } from "node:crypto"

const systemClock: Clock = { now: () => Date.now() }
const systemIds: Ids = {
  id: (prefix) => `${prefix}_${randomUUID()}`,
}

export type LibraryFcp = {
  bindings: LibraryBindings
}

/**
 * Library providers + pull jobs under FLOWAPP_HOME (BL-171 / BL-172).
 * Pull uses the CLI connector transport through ConnectorRuntime.
 */
export function createLibraryFcp(engine: Host, bus: UpdateBus): LibraryFcp {
  const docs = createNodeDocumentStore({ root: engine.home })
  const providers = createProviderService({ docs })
  const connectors = createConnectorService({ docs })
  const runtime = createConnectorRuntime({
    connectors,
    transports: createConnectorTransportRegistry([createNodeCliTransport()]),
  })
  const library = createLibraryService({
    docs,
    bus,
    ids: systemIds,
    clock: systemClock,
    fetcher: createConnectorLibraryFetcher({
      connectors,
      runtime,
      providers,
    }),
  })
  return {
    bindings: createLibraryBindings(providers, library),
  }
}

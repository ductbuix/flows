import { createNodeDocumentStore } from "@workspace/adapters-node"
import {
  createLibraryProviderBindings,
  createProviderService,
  type LibraryProviderBindings,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"

export type LibraryFcp = {
  bindings: LibraryProviderBindings
}

/** Provider descriptors under FLOWAPP_HOME/providers/*.yaml (BL-171 / BL-182). */
export function createLibraryFcp(engine: Engine): LibraryFcp {
  const docs = createNodeDocumentStore({ root: engine.home })
  const service = createProviderService({ docs })
  return {
    bindings: createLibraryProviderBindings(service),
  }
}

import { createNodeDocumentStore } from "@workspace/adapters-node"
import { createFileBindings, type FileBindings } from "@workspace/core"
import type { Engine } from "@workspace/engine"

/** Workspace file/* bindings for FCP (whole FLOWAPP_HOME). */
export function createFileFcp(engine: Engine): FileBindings {
  const docs = createNodeDocumentStore({ root: engine.home })
  return createFileBindings({ docs, allowedRoots: [""] })
}

import {
  createNodeDocumentStore,
  createNodeFileWatcher,
} from "@workspace/adapters-node"
import {
  createSkillCatalog,
  createSkillInstallBindings,
  createSkillReadBindings,
  type SkillCatalog,
  type SkillInstallBindings,
  type SkillReadBindings,
  type SkillSourceReader,
  type UpdateBus,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"

export type SkillsFcp = {
  bindings: SkillReadBindings & SkillInstallBindings
  dispose: () => void
}

/** No Library item reader yet (BL-182); install returns not_found until then. */
const emptySources: SkillSourceReader = {
  getSkill() {
    return null
  },
}

/**
 * Workspace skill catalog for FLOWAPP_HOME. Home (~) skills stay off the
 * daemon for now: DocumentStore.list walks the whole root, which is unsafe
 * on a real home directory.
 */
export function createSkillsFcp(engine: Engine, bus: UpdateBus): SkillsFcp {
  const workspaceDocs = createNodeDocumentStore({ root: engine.home })
  const catalog: SkillCatalog = createSkillCatalog({
    roots: [
      {
        scope: "workspace",
        docs: workspaceDocs,
        watcher: createNodeFileWatcher({ root: engine.home }),
      },
    ],
    bus,
  })
  catalog.start()
  return {
    bindings: {
      ...createSkillReadBindings({ catalog }),
      ...createSkillInstallBindings({
        workspaceDocs,
        catalog,
        bus,
        sources: emptySources,
      }),
    },
    dispose: () => catalog.dispose(),
  }
}

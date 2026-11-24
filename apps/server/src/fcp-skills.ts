import {
  createNodeDocumentStore,
  createNodeFileWatcher,
} from "@workspace/adapters-node"
import {
  createLibrarySkillSourceReader,
  createSkillCatalog,
  createSkillInstallBindings,
  createSkillReadBindings,
  createSkillSourcesBindings,
  type SkillCatalog,
  type SkillInstallBindings,
  type SkillReadBindings,
  type SkillSourcesBindings,
  type UpdateBus,
} from "@workspace/core"
import type { Engine } from "@workspace/adapters-node"

export type SkillsFcp = {
  bindings: SkillReadBindings & SkillInstallBindings & SkillSourcesBindings
  dispose: () => void
}

/**
 * Workspace skill catalog for FLOWAPP_HOME. Home (~) skills stay off the
 * daemon for now: DocumentStore.list walks the whole root, which is unsafe
 * on a real home directory.
 *
 * Skill sources are Library item ids listed in `skills/sources.yaml`;
 * install reads `skills/<slug>/SKILL.md` from a Library version folder.
 */
export function createSkillsFcp(engine: Engine, bus: UpdateBus): SkillsFcp {
  const docs = createNodeDocumentStore({ root: engine.home })
  const catalog: SkillCatalog = createSkillCatalog({
    roots: [
      {
        scope: "workspace",
        docs,
        watcher: createNodeFileWatcher({ root: engine.home }),
      },
    ],
    bus,
  })
  catalog.start()
  const sources = createLibrarySkillSourceReader(docs)
  return {
    bindings: {
      ...createSkillReadBindings({ catalog }),
      ...createSkillInstallBindings({
        workspaceDocs: docs,
        catalog,
        bus,
        sources,
      }),
      ...createSkillSourcesBindings({ docs, bus }),
    },
    dispose: () => catalog.dispose(),
  }
}

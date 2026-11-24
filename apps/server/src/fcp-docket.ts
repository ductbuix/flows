import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  createNodeDocumentStore,
  createNodeFileWatcher,
} from "@workspace/adapters-node"
import {
  createDocketIndex,
  createDocketReadBindings,
  createDocketStore,
  createDocketWriteBindings,
  type Clock,
  type DocketIndex,
  type DocketReadBindings,
  type DocketWriteBindings,
  type UpdateBus,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"

const systemClock: Clock = { now: () => Date.now() }

export type DocketFcp = {
  bindings: DocketReadBindings & DocketWriteBindings
  dispose: () => void
}

/** One docket index per daemon; shared by every FCP peer. */
export function createDocketFcp(engine: Engine, bus: UpdateBus): DocketFcp {
  const docs = createNodeDocumentStore({ root: engine.home })
  const store = createDocketStore({ docs, clock: systemClock })
  const watcher = createNodeFileWatcher({ root: engine.home })
  const index: DocketIndex = createDocketIndex({
    store,
    watcher,
    exists: (path) => existsSync(join(engine.home, path.replace(/^\//, ""))),
  })
  index.start()
  return {
    bindings: {
      ...createDocketReadBindings({ index, store }),
      ...createDocketWriteBindings({ index, store, bus }),
    },
    dispose: () => index.dispose(),
  }
}

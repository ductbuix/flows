import {
  createNodeBlobStore,
  createNodeDocumentStore,
  createNodeFileWatcher,
} from "@workspace/adapters-node"
import { pingMethod } from "@workspace/contracts"
import {
  UpdateBus,
  bindEngine,
  bindInitialize,
  createDocketIndex,
  createDocketReadBindings,
  createDocketStore,
  createDocketWriteBindings,
  createFcpConnection,
  createSubscribeBindings,
  defineBinding,
  type MethodBindings,
} from "@workspace/core"
import {
  RpcPeer,
  messagePortTransport,
  type MessagePortLike,
} from "@workspace/protocol"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"

const engineInfo = { name: "flows-desktop", version: "0.0.1" }

export type DesktopEngine = {
  home: string
  dispose: () => void
  bindPort: (port: MessagePortLike) => void
}

/** Compose core + node adapters for a FLOWAPP_HOME (utility-process host). */
export function composeDesktopEngine(home: string): DesktopEngine {
  const docs = createNodeDocumentStore({ root: home })
  const watcher = createNodeFileWatcher({ root: home })
  const clock = { now: () => Date.now() }
  const store = createDocketStore({ docs, clock })
  const index = createDocketIndex({
    store,
    watcher,
    exists: (path) => {
      const abs = path.startsWith("/") ? path : join(home, path)
      return existsSync(abs)
    },
  })
  index.start()
  const bus = new UpdateBus()
  const blobs = createNodeBlobStore({ root: join(home, "blobs") })

  const docketDeps = { index, store, bus, blobs }
  const bindings: MethodBindings = {
    ping: defineBinding(pingMethod, () => ({ ok: true as const })),
    ...createDocketReadBindings(docketDeps),
    ...createDocketWriteBindings(docketDeps),
  }

  return {
    home,
    dispose: () => index.dispose(),
    bindPort(port) {
      const transport = messagePortTransport(port)
      const peer = new RpcPeer(transport)
      const connection = createFcpConnection()
      const ac = new AbortController()
      const peerId = randomUUID()
      const { bindings: subBindings, dispose: subDispose } =
        createSubscribeBindings(bus, peer, peerId)
      transport.onClose(() => {
        ac.abort()
        subDispose.dispose()
      })
      bindInitialize(peer, connection, {
        engineInfo,
        workspace: { home, id: home },
      })
      bindEngine(
        peer,
        { ...bindings, ...subBindings },
        { signal: ac.signal },
        { connection }
      )
    },
  }
}

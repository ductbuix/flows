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
  createFileBindings,
  createPeerHostReveal,
  createSubscribeBindings,
  defineBinding,
  type MethodBindings,
} from "@workspace/core"
import {
  RpcPeer,
  messagePortTransport,
  type MessagePortLike,
  type Transport,
} from "@workspace/protocol"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"

const engineInfo = { name: "flows-desktop", version: "0.0.1" }

export type DesktopEngine = {
  home: string
  dispose: () => void
  bindTransport: (transport: Transport) => void
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
  const sharedBindings: MethodBindings = {
    ping: defineBinding(pingMethod, () => ({ ok: true as const })),
    ...createDocketReadBindings(docketDeps),
    ...createDocketWriteBindings(docketDeps),
  }

  function bindTransport(transport: Transport): void {
    const peer = new RpcPeer(transport)
    const connection = createFcpConnection()
    const ac = new AbortController()
    const peerId = randomUUID()
    const { bindings: subBindings, dispose: subDispose } =
      createSubscribeBindings(bus, peer, peerId)
    const files = createFileBindings({
      docs,
      allowedRoots: [""],
      reveal: createPeerHostReveal(peer, connection, (storePath) =>
        join(home, storePath)
      ),
    })
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
      { ...sharedBindings, ...files, ...subBindings },
      { signal: ac.signal },
      { connection }
    )
  }

  return {
    home,
    dispose: () => index.dispose(),
    bindTransport,
    bindPort(port) {
      bindTransport(messagePortTransport(port))
    },
  }
}

import { createNodeDocumentStore } from "@workspace/adapters-node"
import {
  createFileBindings,
  createPeerHostReveal,
  type FcpConnection,
  type FileBindings,
} from "@workspace/core"
import type { Engine } from "@workspace/adapters-node"
import type { RpcPeer } from "@workspace/protocol"
import { join } from "node:path"

/** Workspace file/* bindings; reveal asks the client when capable (BL-189). */
export function createFileFcp(
  engine: Engine,
  peer?: RpcPeer,
  connection?: FcpConnection
): FileBindings {
  const docs = createNodeDocumentStore({ root: engine.home })
  const reveal =
    peer && connection
      ? createPeerHostReveal(peer, connection, (storePath) =>
          join(engine.home, storePath)
        )
      : undefined
  return createFileBindings({ docs, allowedRoots: [""], reveal })
}

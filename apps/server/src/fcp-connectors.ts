import { join } from "node:path"
import { createChromeBrowserSignIn } from "@workspace/adapters-node/chrome-browser-sign-in"
import {
  createNodeApiTransport,
  createNodeCliTransport,
  createNodeDocumentStore,
  createNodeMcpTransport,
  createNodeSecretStore,
} from "@workspace/adapters-node"
import type { ConnectorFile } from "@workspace/contracts"
import {
  createConnectorBindings,
  createConnectorRuntime,
  createConnectorService,
  createConnectorTransportRegistry,
  type Clock,
  type ConnectorBindings,
  type FcpConnection,
  type InboxService,
  type UpdateBus,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"
import type { RpcPeer } from "@workspace/protocol"

const systemClock: Clock = { now: () => Date.now() }

export type ConnectorsFcp = {
  /** Shared CRUD/check; pass peer+connection so sign-in can use host. */
  bindings(host?: {
    peer: RpcPeer
    connection: FcpConnection
  }): ConnectorBindings
}

/** Connector CRUD + check + cookie sign-in (BL-160 / BL-164 / BL-190). */
export function createConnectorsFcp(
  engine: Engine,
  bus: UpdateBus,
  inbox: InboxService
): ConnectorsFcp {
  const docs = createNodeDocumentStore({ root: engine.home })
  const service = createConnectorService({ docs })
  const secrets = createNodeSecretStore({
    root: join(engine.home, "secrets"),
  })
  const chromeSignIn = createChromeBrowserSignIn({ home: engine.home })

  const markExpired = (connector: ConnectorFile, detail: string) => {
    const at = new Date(systemClock.now()).toISOString()
    service.setStatus(connector.id, {
      status: "expired",
      checkedAt: at,
      detail,
    })
    bus.publish("connector/update", {
      kind: "status_changed",
      connectorId: connector.id,
      status: "expired",
      checkedAt: at,
      detail,
    })
    inbox.applyConnectorStatus({
      connectorId: connector.id,
      name: connector.name,
      status: "expired",
      at,
    })
  }

  const transports = createConnectorTransportRegistry([
    createNodeCliTransport(),
    createNodeApiTransport({ home: engine.home, onUnauthorized: markExpired }),
    createNodeMcpTransport({ secrets }),
  ])
  const runtime = createConnectorRuntime({ connectors: service, transports })
  const check = {
    runtime,
    bus,
    clock: systemClock,
    onStatusChanged: (change: {
      connectorId: string
      name: string
      status: "connected" | "expired" | "off"
      at: string
      detail?: string
    }) => inbox.applyConnectorStatus(change),
  }

  return {
    bindings(host) {
      return createConnectorBindings(service, {
        check,
        signIn: {
          secrets,
          chromeSignIn,
          peer: host?.peer,
          connection: host?.connection,
        },
      })
    },
  }
}

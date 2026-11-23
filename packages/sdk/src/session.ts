import { RpcPeer, type Transport } from "@workspace/protocol"
import { ProtocolVersionError } from "./errors.ts"
import {
  buildInitializeParams,
  isSupportedProtocolVersion,
  type ClientCapabilities,
  type ClientInfo,
  type InitializeResult,
} from "./initialize.ts"

export type SessionHooks = {
  readonly onDrop: (err?: Error) => void
  readonly notificationHandlers: Map<string, Set<(params: unknown) => void>>
}

export type OpenSessionResult = {
  readonly peer: RpcPeer
  readonly transport: Transport
  readonly initialize: InitializeResult
}

export async function openSession(
  connect: () => Promise<Transport>,
  clientInfo: ClientInfo,
  capabilities: ClientCapabilities,
  hooks: SessionHooks,
  closed: () => boolean
): Promise<OpenSessionResult> {
  const transport = await connect()
  const peer = new RpcPeer(transport)
  for (const method of hooks.notificationHandlers.keys()) {
    peer.onNotification(method, (params) => {
      for (const handler of hooks.notificationHandlers.get(method) ?? []) {
        handler(params)
      }
    })
  }
  transport.onClose((err) => {
    if (closed()) return
    hooks.onDrop(err)
  })
  const raw = await peer.request(
    "initialize",
    buildInitializeParams(clientInfo, capabilities)
  )
  const initialize = raw as InitializeResult
  if (!isSupportedProtocolVersion(initialize.protocolVersion)) {
    peer.dispose()
    transport.close()
    throw new ProtocolVersionError(initialize.protocolVersion)
  }
  return { peer, transport, initialize }
}

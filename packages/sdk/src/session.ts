import { initializeMethod } from "@workspace/contracts"
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
  readonly onNotify?: (method: string, params: unknown) => void
}

export type OpenSessionResult = {
  readonly peer: RpcPeer
  readonly transport: Transport
  readonly initialize: InitializeResult
}

export function deliverNotification(
  hooks: Pick<SessionHooks, "notificationHandlers" | "onNotify">,
  method: string,
  params: unknown
): void {
  hooks.onNotify?.(method, params)
  for (const handler of hooks.notificationHandlers.get(method) ?? []) {
    handler(params)
  }
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
      deliverNotification(hooks, method, params)
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
  const initialize = initializeMethod.result.parse(raw)
  if (!isSupportedProtocolVersion(initialize.protocolVersion)) {
    peer.dispose()
    transport.close()
    throw new ProtocolVersionError(initialize.protocolVersion)
  }
  return { peer, transport, initialize }
}

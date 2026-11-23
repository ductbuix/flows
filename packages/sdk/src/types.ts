import {
  fcpMethodTable,
  fcpNotificationTable,
  type FcpMethodParams,
  type FcpMethodResult,
  type FcpNotificationParams,
} from "@workspace/contracts"
import type { BackoffOptions } from "./backoff.ts"
import type { CreateClientConnectOptions } from "./connect.ts"
import type {
  ClientCapabilities,
  ClientInfo,
  InitializeResult,
} from "./initialize.ts"

export type FcpMethodName = keyof typeof fcpMethodTable
export type FcpNotificationName = keyof typeof fcpNotificationTable

export type CreateClientOptions = CreateClientConnectOptions & {
  readonly token?: string
  readonly capabilities?: ClientCapabilities
  readonly clientInfo?: ClientInfo
  readonly backoff?: BackoffOptions
}

/** Client-local events (not FCP notifications). */
export type ClientEventMap = {
  resync: (topic: string) => void
}

export type FlowsClient = {
  readonly ready: Promise<InitializeResult>
  call<M extends FcpMethodName>(
    method: M,
    params: FcpMethodParams<(typeof fcpMethodTable)[M]>
  ): Promise<FcpMethodResult<(typeof fcpMethodTable)[M]>>
  onNotification<M extends FcpNotificationName>(
    method: M,
    handler: (
      params: FcpNotificationParams<(typeof fcpNotificationTable)[M]>
    ) => void
  ): () => void
  on<E extends keyof ClientEventMap>(
    event: E,
    handler: ClientEventMap[E]
  ): () => void
  close(): void
}

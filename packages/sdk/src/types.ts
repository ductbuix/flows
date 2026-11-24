import {
  fcpHostMethodTable,
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
export type FcpHostMethodName = keyof typeof fcpHostMethodTable

/** Params for `client.call(method, params)` / `useQuery(method, params, …)`. */
export type FcpCallParams<M extends FcpMethodName> = FcpMethodParams<
  (typeof fcpMethodTable)[M]
>
/** Result of `client.call(method, params)` / `useQuery` data. */
export type FcpCallResult<M extends FcpMethodName> = FcpMethodResult<
  (typeof fcpMethodTable)[M]
>

export type FcpHostParams<M extends FcpHostMethodName> = FcpMethodParams<
  (typeof fcpHostMethodTable)[M]
>
export type FcpHostResult<M extends FcpHostMethodName> = FcpMethodResult<
  (typeof fcpHostMethodTable)[M]
>

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
    params: FcpCallParams<M>
  ): Promise<FcpCallResult<M>>
  onNotification<M extends FcpNotificationName>(
    method: M,
    handler: (
      params: FcpNotificationParams<(typeof fcpNotificationTable)[M]>
    ) => void
  ): () => void
  /** Engine → client host requests (`host/reveal_path`, …). */
  onRequest<M extends FcpHostMethodName>(
    method: M,
    handler: (
      params: FcpHostParams<M>
    ) => FcpHostResult<M> | Promise<FcpHostResult<M>>
  ): () => void
  on<E extends keyof ClientEventMap>(
    event: E,
    handler: ClientEventMap[E]
  ): () => void
  close(): void
}

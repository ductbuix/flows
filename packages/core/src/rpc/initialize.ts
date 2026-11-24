import {
  FCP_VERSION,
  initializeMethod,
  type FcpMethodResult,
} from "@workspace/contracts"
import {
  JSONRPC_INVALID_REQUEST,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import type { Disposable } from "../ports/file-watcher.ts"
import type { ClientInfo } from "./context.ts"
import { invalidParamsError } from "./map-error.ts"

export type FcpConnection = {
  initialized: boolean
  clientInfo?: ClientInfo
  clientCapabilities?: Record<string, unknown>
  protocolVersion?: number
}

export type BindInitializeOptions = {
  readonly engineInfo: ClientInfo
  readonly workspace: { readonly home: string; readonly id: string }
  /** Optional extras; blobs.http advertises the daemon blob base URL (DES-040). */
  readonly engineCapabilities?: {
    readonly blobs?: { readonly http: string }
  }
}

export function createFcpConnection(): FcpConnection {
  return { initialized: false }
}

export function invalidRequestError(message: string): JsonRpcResponseError {
  return new JsonRpcResponseError({
    code: JSONRPC_INVALID_REQUEST,
    message,
    data: { code: "invalid_request" },
  })
}

export function bindInitialize(
  peer: RpcPeer,
  connection: FcpConnection,
  options: BindInitializeOptions
): Disposable {
  const unsub = peer.onRequest("initialize", async (raw) => {
    const parsed = initializeMethod.params.safeParse(raw ?? {})
    if (!parsed.success) {
      throw invalidParamsError(parsed.error)
    }
    const { clientInfo, clientCapabilities } = parsed.data

    connection.initialized = true
    connection.clientInfo = clientInfo
    connection.clientCapabilities = clientCapabilities as Record<
      string,
      unknown
    >
    connection.protocolVersion = FCP_VERSION

    const result: FcpMethodResult<typeof initializeMethod> = {
      protocolVersion: FCP_VERSION,
      engineInfo: options.engineInfo,
      engineCapabilities: {
        agents: [],
        nodeKinds: [],
        ...(options.engineCapabilities?.blobs
          ? { blobs: options.engineCapabilities.blobs }
          : {}),
      },
      workspace: options.workspace,
    }

    const checked = initializeMethod.result.safeParse(result)
    if (!checked.success) {
      throw new JsonRpcResponseError({
        code: -32603,
        message: "Invalid initialize result",
        data: { code: "internal" },
      })
    }
    return checked.data
  })

  return { dispose: unsub }
}

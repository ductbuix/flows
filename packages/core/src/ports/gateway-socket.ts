/**
 * Unix-socket face for packages/mcp-gateway (DES-041 / BL-166).
 * Node adapter listens; fake drives onCall in process.
 */

export const GATEWAY_CALL_METHOD = "gateway/call"
export const GATEWAY_TOKEN_ENV = "FLOWS_GATEWAY_TOKEN"

export type GatewaySocketCall = {
  name: string
  arguments: Record<string, unknown>
}

export type GatewaySocketCallResult = {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export type GatewaySocketListenOpts = {
  /** Absolute unix socket path. */
  path: string
  /** Per-step token; mismatched tokens are refused. */
  token: string
  onCall: (
    call: GatewaySocketCall,
    signal: AbortSignal
  ) => Promise<GatewaySocketCallResult>
}

export type GatewaySocketHandle = {
  readonly path: string
  close(): Promise<void>
}

export interface GatewaySocketServer {
  listen(opts: GatewaySocketListenOpts): Promise<GatewaySocketHandle>
}

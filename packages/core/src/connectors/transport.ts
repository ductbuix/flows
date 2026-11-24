import type {
  Capability,
  ConnectorFile,
  ConnectorTransport,
} from "@workspace/contracts"

/** Result of one connector capability call (DES-041 ConnectorRuntime). */
export type ConnectorCallResult = {
  stdout: string
  stderr: string
  exitCode: number
}

/** Result of `check` for one connector. */
export type ConnectorCheckResult = {
  ok: boolean
  detail?: string
}

/**
 * Strategy for one transport kind (DES-041 / DES-042). Named Handler so it
 * does not clash with the contracts `ConnectorTransport` string enum.
 */
export interface ConnectorTransportHandler {
  readonly kind: ConnectorTransport
  call(
    connector: ConnectorFile,
    capability: Capability,
    args: readonly string[],
    signal: AbortSignal
  ): Promise<ConnectorCallResult>
  check?(
    connector: ConnectorFile,
    signal: AbortSignal
  ): Promise<ConnectorCheckResult>
}

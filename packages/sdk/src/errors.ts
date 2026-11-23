/** Pending call failed because the transport dropped; safe to retry after reconnect. */
export class RetryableConnectionError extends Error {
  readonly retryable = true as const

  constructor(message = "connection dropped", cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined)
    this.name = "RetryableConnectionError"
  }
}

export class ProtocolVersionError extends Error {
  constructor(version: number) {
    super(`unsupported protocolVersion: ${version}`)
    this.name = "ProtocolVersionError"
  }
}

export function asRetryable(err: unknown): RetryableConnectionError {
  if (err instanceof RetryableConnectionError) return err
  return new RetryableConnectionError(
    err instanceof Error ? err.message : "connection dropped",
    err
  )
}

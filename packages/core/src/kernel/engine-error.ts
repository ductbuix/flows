/** Stable FCP error codes (DES-040); callers may extend with strings until contracts owns the enum. */
export type EngineErrorCode =
  | "invalid_params"
  | "not_found"
  | "conflict"
  | "busy"
  | "policy_denied"
  | "needs_trust"
  | "unsupported"
  | "cancelled"
  | "internal"
  | (string & {})

export type EngineError = {
  readonly code: EngineErrorCode
  readonly message: string
  readonly data?: unknown
}

export function engineError(
  code: EngineErrorCode,
  message: string,
  data?: unknown
): EngineError {
  return data === undefined ? { code, message } : { code, message, data }
}

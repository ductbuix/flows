/** Stable FCP `data.code` values and JSON-RPC `error.code` (DES-040). */
export const ErrorCode = {
  invalid_params: -32602,
  not_found: -32004,
  conflict: -32009,
  busy: -32010,
  policy_denied: -32011,
  needs_trust: -32012,
  unsupported: -32013,
  cancelled: -32800,
  internal: -32603,
} as const

export type ErrorCode = keyof typeof ErrorCode

export function jsonRpcCodeFor(code: ErrorCode): number {
  return ErrorCode[code]
}

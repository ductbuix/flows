import { ErrorCode } from "@workspace/contracts"

/** JSON-RPC conflict from FCP (`data.code` or numeric code). */
export function isConflictError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const value = err as { code?: unknown; data?: { code?: unknown } }
  if (value.code === ErrorCode.conflict) return true
  return value.data?.code === "conflict"
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

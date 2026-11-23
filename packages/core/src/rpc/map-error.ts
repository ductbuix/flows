import {
  ErrorCode,
  jsonRpcCodeFor,
  type ErrorCode as FcpErrorCode,
} from "@workspace/contracts"
import { JsonRpcResponseError } from "@workspace/protocol"
import type { EngineError } from "../kernel/engine-error.ts"

const fcpCodes = new Set<string>(Object.keys(ErrorCode))

function isFcpErrorCode(code: string): code is FcpErrorCode {
  return fcpCodes.has(code)
}

export function isEngineError(thrown: unknown): thrown is EngineError {
  if (typeof thrown !== "object" || thrown === null) return false
  const value = thrown as Record<string, unknown>
  return typeof value.code === "string" && typeof value.message === "string"
}

export function invalidParamsError(error: {
  issues: ReadonlyArray<{ path: PropertyKey[] }>
}): JsonRpcResponseError {
  return new JsonRpcResponseError({
    code: ErrorCode.invalid_params,
    message: "Invalid params",
    data: {
      code: "invalid_params",
      issues: error.issues.map((issue) => ({ path: issue.path })),
    },
  })
}

export function engineErrorToJsonRpc(error: EngineError): JsonRpcResponseError {
  const code = isFcpErrorCode(error.code)
    ? jsonRpcCodeFor(error.code)
    : ErrorCode.internal
  const dataCode = isFcpErrorCode(error.code) ? error.code : "internal"
  return new JsonRpcResponseError({
    code,
    message: error.message,
    data: mergeErrorData(dataCode, error.data),
  })
}

export function internalError(message: string): JsonRpcResponseError {
  return new JsonRpcResponseError({
    code: ErrorCode.internal,
    message,
    data: { code: "internal" },
  })
}

function mergeErrorData(code: string, extra: unknown): Record<string, unknown> {
  if (extra === undefined) return { code }
  if (typeof extra === "object" && extra !== null && !Array.isArray(extra)) {
    return { code, ...(extra as Record<string, unknown>) }
  }
  return { code, detail: extra }
}

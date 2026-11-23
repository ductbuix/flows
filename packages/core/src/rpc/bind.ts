import type {
  FcpMethodDef,
  FcpMethodParams,
  FcpMethodResult,
} from "@workspace/contracts"
import { JsonRpcResponseError, RpcPeer } from "@workspace/protocol"
import type { Logger } from "../kernel/logger.ts"
import type { Disposable } from "../ports/file-watcher.ts"
import type { ClientContext } from "./context.ts"
import {
  engineErrorToJsonRpc,
  internalError,
  invalidParamsError,
  isEngineError,
} from "./map-error.ts"

export type { ClientContext, ClientInfo } from "./context.ts"

export type MethodHandler<M extends FcpMethodDef> = (
  params: FcpMethodParams<M>,
  ctx: ClientContext
) => FcpMethodResult<M> | Promise<FcpMethodResult<M>>

export type MethodBinding<M extends FcpMethodDef = FcpMethodDef> = {
  readonly method: M
  readonly handler: MethodHandler<M>
}

export type MethodBindings = Record<string, MethodBinding>

export function defineBinding<M extends FcpMethodDef>(
  method: M,
  handler: MethodHandler<M>
): MethodBinding<M> {
  return { method, handler }
}

export type BindEngineOptions = {
  readonly logger?: Logger
  /** Default: validate when `NODE_ENV` is not `production`. */
  readonly validateResults?: boolean
}

function nodeEnv(): string | undefined {
  return (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process
    ?.env?.NODE_ENV
}

function shouldValidateResults(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit
  return nodeEnv() !== "production"
}

export function bindEngine(
  peer: RpcPeer,
  bindings: MethodBindings,
  ctx: ClientContext,
  options?: BindEngineOptions
): Disposable {
  const logger = options?.logger
  const validateResults = shouldValidateResults(options?.validateResults)
  const unsubs: (() => void)[] = []

  for (const [name, binding] of Object.entries(bindings)) {
    const { method, handler } = binding
    unsubs.push(
      peer.onRequest(name, async (raw) => {
        const parsed = method.params.safeParse(raw ?? {})
        if (!parsed.success) {
          throw invalidParamsError(parsed.error)
        }
        try {
          let result = await handler(parsed.data, ctx)
          if (validateResults) {
            const checked = method.result.safeParse(result)
            if (!checked.success) {
              logger?.error("fcp handler returned invalid result", {
                method: name,
              })
              throw internalError("Invalid result")
            }
            result = checked.data
          }
          return result
        } catch (thrown) {
          if (thrown instanceof JsonRpcResponseError) {
            throw thrown
          }
          if (isEngineError(thrown)) {
            throw engineErrorToJsonRpc(thrown)
          }
          logger?.error("fcp handler failed", {
            method: name,
            err: thrown instanceof Error ? thrown.message : String(thrown),
          })
          const message =
            thrown instanceof Error ? thrown.message : "Internal error"
          throw internalError(message)
        }
      })
    )
  }

  return {
    dispose() {
      for (const unsub of unsubs) unsub()
      unsubs.length = 0
    },
  }
}

import {
  defineBinding,
  engineError,
  type MethodBindings,
} from "@workspace/core"
import {
  diffWorkCopy,
  runDir,
  workflowDir,
  type Host,
} from "@workspace/adapters-node"
import {
  runCancelMethod,
  runChangesResponseSchema,
  runDeleteMethod,
  runGetChangesMethod,
  runGetLogMethod,
  runRerunMethod,
  runRetryStepMethod,
  runStartMethod,
} from "@workspace/contracts"
import type { CoreRunHost } from "./core-run-host.ts"
import type { IdempotencyStore } from "./idempotency.ts"
import { readLogChunk, resolveAttemptRoot } from "./run-files.ts"
import { startRunForFcp } from "./fcp-run-start.ts"

export type RunCommandBindings = Pick<
  MethodBindings,
  | "run/start"
  | "run/cancel"
  | "run/rerun"
  | "run/retry_step"
  | "run/delete"
  | "run/get_log"
  | "run/get_changes"
>

export type RunCommandDeps = {
  engine: Host
  idempotency: IdempotencyStore
  coreRuns: CoreRunHost
}

export function createRunCommandBindings(
  deps: RunCommandDeps
): RunCommandBindings {
  const { engine, idempotency, coreRuns } = deps
  return {
    "run/start": defineBinding(runStartMethod, async (params) => {
      if (params.requestKey) {
        const cached = idempotency.get(params.requestKey)
        if (cached?.body && typeof cached.body === "object") {
          const runId = (cached.body as { runId?: string }).runId
          if (typeof runId === "string") return { runId }
        }
      }
      const result = await startRunForFcp(
        engine,
        {
          workflowId: params.workflowId,
          values: params.values,
          cardId: params.cardId,
          refreshPins: params.refreshPins,
          only: params.only,
          from: params.from,
          baseRunId: params.baseRunId,
        },
        coreRuns
      )
      if (params.requestKey) {
        idempotency.set(params.requestKey, 200, result)
      }
      return result
    }),
    "run/cancel": defineBinding(runCancelMethod, async (params) => {
      try {
        if (await coreRuns.cancel(params.runId)) return {}
        engine.cancelRun(params.runId)
        return {}
      } catch (err) {
        throw mapControlError(err)
      }
    }),
    "run/rerun": defineBinding(runRerunMethod, async (params) => {
      if (params.requestKey) {
        const cached = idempotency.get(params.requestKey)
        if (cached?.body && typeof cached.body === "object") {
          const runId = (cached.body as { runId?: string }).runId
          if (typeof runId === "string") return { runId }
        }
      }
      const state = engine.fold(params.runId)
      if (!state || state.deleted) {
        throw engineError("not_found", `Run not found: ${params.runId}`)
      }
      if (state.status === "running" || state.status === "queued") {
        throw engineError("busy", "run is still live")
      }
      const result = await startRunForFcp(
        engine,
        {
          workflowId: state.workflowId,
          values: params.values,
          refreshPins: params.refreshPins,
          only: params.only,
          from: params.from,
          baseRunId: params.baseRunId,
          rerunOf: { runId: params.runId, cardId: state.cardId },
        },
        coreRuns
      )
      if (params.requestKey) {
        idempotency.set(params.requestKey, 200, result)
      }
      return result
    }),
    "run/retry_step": defineBinding(runRetryStepMethod, async (params) => {
      try {
        await coreRuns.retryStep(params.runId, params.stepId)
        return {}
      } catch (err) {
        throw mapControlError(err)
      }
    }),
    "run/delete": defineBinding(runDeleteMethod, (params) => {
      try {
        engine.deleteRun(params.runId)
        return {}
      } catch (err) {
        throw mapControlError(err)
      }
    }),
    "run/get_log": defineBinding(runGetLogMethod, (params) => {
      const attemptRoot = resolveAttemptRoot(
        engine,
        params.runId,
        params.stepId,
        params.attempt
      )
      if (!attemptRoot) {
        throw engineError("not_found", "attempt not found")
      }
      return readLogChunk(attemptRoot, params.stream, params.offset ?? 0)
    }),
    "run/get_changes": defineBinding(runGetChangesMethod, async (params) => {
      const state = engine.fold(params.runId)
      if (!state || state.deleted) {
        throw engineError("not_found", `Run not found: ${params.runId}`)
      }
      const root = runDir(
        workflowDir(engine.home, state.workflowId),
        params.runId
      )
      try {
        const result = await diffWorkCopy({
          home: engine.home,
          runRoot: root,
          connectionId: params.connectionId,
        })
        return runChangesResponseSchema.parse(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : "diff failed"
        if (/unknown connection|unknown connector/.test(message)) {
          throw engineError("not_found", message)
        }
        throw engineError("invalid_params", message)
      }
    }),
  }
}

function mapControlError(err: unknown): never {
  const message = err instanceof Error ? err.message : "request failed"
  if (/unknown run|not found|deleted/i.test(message)) {
    throw engineError("not_found", message)
  }
  if (
    /cannot delete live|not live|cannot be retried|not awaiting/i.test(message)
  ) {
    throw engineError("busy", message)
  }
  throw engineError("invalid_params", message)
}

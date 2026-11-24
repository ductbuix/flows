import type { EngineEvent } from "@workspace/contracts"
import {
  decidePermission,
  type PermissionContext,
} from "../agents/permission-policy.ts"
import type { ConnectorRuntime } from "../connectors/runtime.ts"
import type { ConnectorService } from "../connectors/service.ts"
import type { Clock } from "../kernel/clock.ts"
import { engineError, type EngineError } from "../kernel/engine-error.ts"
import { isEngineError } from "../rpc/map-error.ts"
import type { EventStore } from "../ports/event-store.ts"
import type {
  GatewaySocketCall,
  GatewaySocketCallResult,
} from "../ports/gateway-socket.ts"

/** Maps an MCP tool name to a connector capability. */
export type GatewayToolBinding = {
  name: string
  connectorId: string
  capability: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export type GatewayStepCallContext = {
  runId: string
  nodeId: string
  pass: number
  permission: PermissionContext
  tools: readonly GatewayToolBinding[]
}

export type GatewayCallHandlerDeps = {
  runtime: ConnectorRuntime
  connectors: ConnectorService
  events: EventStore
  clock: Clock
}

/** Turn gateway JSON args into CLI positional strings. */
export function gatewayArgsToCli(args: Record<string, unknown>): string[] {
  const positional = args.args
  if (Array.isArray(positional)) {
    return positional.map((v) => String(v))
  }
  return Object.keys(args)
    .sort()
    .map((k) => {
      const v = args[k]
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        return String(v)
      }
      return JSON.stringify(v)
    })
}

/**
 * Permission chain then ConnectorRuntime; always appends `connector_called`.
 */
export function createGatewayCallHandler(deps: GatewayCallHandlerDeps) {
  return async function handleGatewayCall(
    step: GatewayStepCallContext,
    call: GatewaySocketCall,
    signal: AbortSignal
  ): Promise<GatewaySocketCallResult> {
    const binding = step.tools.find((t) => t.name === call.name)
    if (!binding) {
      return errorResult(`unknown tool: ${call.name}`)
    }

    const write = capabilityIsWrite(
      deps.connectors,
      binding.connectorId,
      binding.capability
    )
    const decision = decidePermission(
      {
        tool: call.name,
        ...(write === true ? { connectorWrite: true } : {}),
      },
      step.permission
    )

    if (decision.outcome === "reject" || decision.outcome === "ask") {
      const message =
        decision.outcome === "ask"
          ? `permission required for ${call.name}`
          : `denied by ${decision.rule}: ${call.name}`
      appendCalled(deps, step, binding, "denied", message)
      return errorResult(message)
    }

    try {
      const result = await deps.runtime.call(
        binding.connectorId,
        binding.capability,
        gatewayArgsToCli(call.arguments),
        signal
      )
      if (result.exitCode !== 0) {
        const message =
          result.stderr.trim() ||
          result.stdout.trim() ||
          `exit ${result.exitCode}`
        appendCalled(deps, step, binding, "error", message)
        return errorResult(message)
      }
      appendCalled(deps, step, binding, "ok")
      return {
        content: [
          {
            type: "text",
            text: result.stdout || JSON.stringify({ ok: true }),
          },
        ],
      }
    } catch (err) {
      const message = errorMessage(err)
      const status =
        isEngineError(err) && err.code === "policy_denied" ? "denied" : "error"
      appendCalled(deps, step, binding, status, message)
      return errorResult(message)
    }
  }
}

function capabilityIsWrite(
  connectors: ConnectorService,
  connectorId: string,
  capability: string
): boolean | undefined {
  const record = connectors.get(connectorId)
  const cap = record?.connector.capabilities.find((c) => c.name === capability)
  return cap?.write
}

function appendCalled(
  deps: GatewayCallHandlerDeps,
  step: GatewayStepCallContext,
  binding: GatewayToolBinding,
  status: "ok" | "denied" | "error",
  message?: string
): void {
  const event: EngineEvent = {
    type: "connector_called",
    runId: step.runId,
    at: new Date(deps.clock.now()).toISOString(),
    nodeId: step.nodeId,
    pass: step.pass,
    connectorId: binding.connectorId,
    capability: binding.capability,
    status,
    ...(message !== undefined ? { message } : {}),
  }
  appendWithRetry(deps.events, step.runId, event)
}

function appendWithRetry(
  store: EventStore,
  runId: string,
  event: EngineEvent
): void {
  for (let i = 0; i < 8; i++) {
    const list = store.read(runId)
    const expectSeq = list.length === 0 ? 0 : list[list.length - 1]!.seq
    const result = store.append(runId, [event], { expectSeq })
    if (result.ok) return
  }
  throw engineError("conflict", "Could not append connector_called")
}

function errorResult(message: string): GatewaySocketCallResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  }
}

function errorMessage(err: unknown): string {
  if (isEngineError(err)) return (err as EngineError).message
  if (err instanceof Error) return err.message
  return String(err)
}

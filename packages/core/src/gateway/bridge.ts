import type { PermissionContext } from "../agents/permission-policy.ts"
import type { Ids } from "../kernel/ids.ts"
import type {
  GatewaySocketHandle,
  GatewaySocketServer,
} from "../ports/gateway-socket.ts"
import {
  createGatewayCallHandler,
  type GatewayCallHandlerDeps,
  type GatewayToolBinding,
} from "./call-handler.ts"
import {
  buildGatewayLaunchSpec,
  gatewayToolsJson,
  type GatewayLaunchSpec,
} from "./launch-spec.ts"

export type OpenGatewayStepInput = {
  runId: string
  nodeId: string
  pass: number
  /** Absolute unix socket path for this step. */
  socketPath: string
  /** Absolute path the gateway will read for `--tools`. */
  toolsPath: string
  tools: readonly GatewayToolBinding[]
  permission: PermissionContext
  /** Executable for packages/mcp-gateway. */
  gatewayCommand: string
  /** Argv before `--tools` (e.g. path to cli.ts when using tsx). */
  gatewayPrefixArgs?: readonly string[]
}

export type GatewayStepSession = {
  readonly launchSpec: GatewayLaunchSpec
  readonly socketPath: string
  readonly token: string
  /** Contents to write at `toolsPath` before launching the gateway. */
  readonly toolsJson: string
  close(): Promise<void>
}

export type McpGatewayBridge = {
  openStep(input: OpenGatewayStepInput): Promise<GatewayStepSession>
}

export type McpGatewayBridgeDeps = GatewayCallHandlerDeps & {
  sockets: GatewaySocketServer
  ids: Ids
}

/**
 * One socket per step: listen, mint token, hand back a launch spec for
 * packages/mcp-gateway. Socket is removed on `close` (BL-166).
 */
export function createMcpGatewayBridge(
  deps: McpGatewayBridgeDeps
): McpGatewayBridge {
  const handleCall = createGatewayCallHandler(deps)

  return {
    async openStep(input) {
      const token = deps.ids.id("gwt")
      const toolsJson = gatewayToolsJson(input.tools)
      const step = {
        runId: input.runId,
        nodeId: input.nodeId,
        pass: input.pass,
        permission: input.permission,
        tools: input.tools,
      }

      let handle: GatewaySocketHandle | undefined
      handle = await deps.sockets.listen({
        path: input.socketPath,
        token,
        onCall: (call, signal) => handleCall(step, call, signal),
      })

      const launchSpec = buildGatewayLaunchSpec({
        command: input.gatewayCommand,
        prefixArgs: input.gatewayPrefixArgs,
        toolsPath: input.toolsPath,
        socketPath: input.socketPath,
        token,
      })

      return {
        launchSpec,
        socketPath: input.socketPath,
        token,
        toolsJson,
        async close() {
          if (handle) {
            const h = handle
            handle = undefined
            await h.close()
          }
        },
      }
    },
  }
}

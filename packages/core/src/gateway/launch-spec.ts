import { GATEWAY_TOKEN_ENV } from "../ports/gateway-socket.ts"

/** How to spawn packages/mcp-gateway for one step (BL-167 consumes this). */
export type GatewayLaunchSpec = {
  command: string
  args: string[]
  env: Record<string, string>
}

export type BuildGatewayLaunchSpecInput = {
  /** Binary or node entry for packages/mcp-gateway. */
  command: string
  /** Extra argv before `--tools` (e.g. `tsx` script path). */
  prefixArgs?: readonly string[]
  toolsPath: string
  socketPath: string
  token: string
}

/** Pure: command + args + env for the stdio MCP gateway process. */
export function buildGatewayLaunchSpec(
  input: BuildGatewayLaunchSpecInput
): GatewayLaunchSpec {
  return {
    command: input.command,
    args: [
      ...(input.prefixArgs ?? []),
      "--tools",
      input.toolsPath,
      "--socket",
      input.socketPath,
    ],
    env: { [GATEWAY_TOKEN_ENV]: input.token },
  }
}

/** Tool row written to the gateway `--tools` JSON. */
export type GatewayToolSpec = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/** JSON text for `--tools` (no disk I/O). */
export function gatewayToolsJson(tools: readonly GatewayToolSpec[]): string {
  return JSON.stringify({
    tools: tools.map((t) => ({
      name: t.name,
      ...(t.description !== undefined ? { description: t.description } : {}),
      inputSchema: t.inputSchema ?? { type: "object" },
    })),
  })
}

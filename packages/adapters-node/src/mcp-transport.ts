import {
  createMcpTransport,
  type ConnectorTransportHandler,
  type SecretStore,
} from "@workspace/core"
import { createNodeMcpConnect } from "./mcp-session.ts"
import { createNodeProcessRunner } from "./process-runner.ts"

export type NodeMcpTransportOptions = {
  secrets?: SecretStore
  fetch?: typeof globalThis.fetch
}

/** MCP connector transport over ProcessRunner stdio or HTTP URL (BL-163). */
export function createNodeMcpTransport(
  options: NodeMcpTransportOptions = {}
): ConnectorTransportHandler {
  return createMcpTransport({
    connect: createNodeMcpConnect({
      runner: createNodeProcessRunner(),
      secrets: options.secrets,
      fetch: options.fetch,
    }),
  })
}

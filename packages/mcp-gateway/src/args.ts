export type GatewayArgs = {
  toolsPath: string
  socketPath: string
}

/**
 * Parse `flows-mcp-gateway --tools <path> --socket <path>`.
 */
export function parseGatewayArgs(argv: string[]): GatewayArgs {
  let toolsPath: string | undefined
  let socketPath: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === "--tools" && next) {
      toolsPath = next
      i++
      continue
    }
    if (arg === "--socket" && next) {
      socketPath = next
      i++
      continue
    }
    throw new Error(`unknown or incomplete argument: ${arg}`)
  }

  if (!toolsPath) throw new Error("missing --tools <path>")
  if (!socketPath) throw new Error("missing --socket <path>")
  return { toolsPath, socketPath }
}

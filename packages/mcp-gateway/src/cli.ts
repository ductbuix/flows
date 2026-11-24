import { readFileSync } from "node:fs"
import { ndjsonTransport } from "@workspace/protocol/node"
import { parseGatewayArgs } from "./args.ts"
import { connectEngineBridge } from "./engine-bridge.ts"
import { createMcpGateway } from "./gateway.ts"
import { parseToolsSpec } from "./tools-spec.ts"

export async function main(argv: string[]): Promise<{ close(): void }> {
  const { toolsPath, socketPath } = parseGatewayArgs(argv)
  const tools = parseToolsSpec(JSON.parse(readFileSync(toolsPath, "utf8")))
  const engine = await connectEngineBridge(socketPath)
  const transport = ndjsonTransport(process.stdin, process.stdout)
  return createMcpGateway({ tools: tools.tools, engine, transport })
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("/cli.ts") ||
    process.argv[1].endsWith("/cli.js") ||
    process.argv[1].includes("mcp-gateway"))

if (isDirect) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}

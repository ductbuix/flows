import type { Capability, ConnectorFile } from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { McpConnect, McpToolInfo } from "./mcp-session.ts"
import type {
  ConnectorCallResult,
  ConnectorCheckResult,
  ConnectorTransportHandler,
} from "./transport.ts"

export type McpTransportDeps = {
  connect: McpConnect
}

/**
 * MCP transport: `how` is a local command or URL. Check lists tools as
 * capabilities; call runs `tools/call` after the runtime capability gate
 * (BL-163).
 */
export function createMcpTransport(
  deps: McpTransportDeps
): ConnectorTransportHandler {
  return {
    kind: "mcp",
    async call(connector, capability, args, signal) {
      assertMcpConnector(connector)
      const session = await deps.connect(connector, signal)
      try {
        const result = await session.callTool(
          capability.name,
          argsToMcpArguments(args)
        )
        return toolResultToCall(result)
      } finally {
        session.close()
      }
    },
    async check(connector, signal): Promise<ConnectorCheckResult> {
      assertMcpConnector(connector)
      try {
        const session = await deps.connect(connector, signal)
        try {
          const tools = await session.listTools()
          const names = tools.map((t) => t.name)
          return {
            ok: true,
            detail:
              names.length > 0 ? `tools: ${names.join(", ")}` : "tools: (none)",
            tools,
          }
        } finally {
          session.close()
        }
      } catch (err) {
        return {
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        }
      }
    },
  }
}

/** Map listed MCP tools onto connector capabilities, keeping `allowed`. */
export function mergeListedTools(
  connector: ConnectorFile,
  tools: readonly McpToolInfo[]
): ConnectorFile {
  const prev = new Map(connector.capabilities.map((c) => [c.name, c] as const))
  const capabilities: Capability[] = tools.map((t) => {
    const existing = prev.get(t.name)
    if (existing) {
      return {
        ...existing,
        desc: t.description ?? existing.desc,
      }
    }
    return {
      name: t.name,
      desc: t.description ?? "",
      write: false,
      allowed: true,
    }
  })
  return { ...connector, capabilities }
}

/** Turn runtime string args into an MCP `arguments` object. */
export function argsToMcpArguments(
  args: readonly string[]
): Record<string, unknown> {
  if (args.length === 1) {
    try {
      const parsed: unknown = JSON.parse(args[0]!)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      /* treat as positional */
    }
  }
  if (args.length === 0) return {}
  return { args: [...args] }
}

function toolResultToCall(result: unknown): ConnectorCallResult {
  if (
    result &&
    typeof result === "object" &&
    "content" in result &&
    Array.isArray((result as { content: unknown }).content)
  ) {
    const body = result as {
      content: Array<{ type?: string; text?: string }>
      isError?: boolean
    }
    const text = body.content
      .map((c) => (typeof c.text === "string" ? c.text : JSON.stringify(c)))
      .join("\n")
    if (body.isError) {
      return { stdout: "", stderr: text || "tool error", exitCode: 1 }
    }
    return { stdout: text, stderr: "", exitCode: 0 }
  }
  return {
    stdout: JSON.stringify(result ?? null),
    stderr: "",
    exitCode: 0,
  }
}

function assertMcpConnector(connector: ConnectorFile): void {
  if (connector.transport !== "mcp") {
    throw engineError(
      "invalid_params",
      `MCP transport cannot run connector with transport "${connector.transport}"`
    )
  }
}

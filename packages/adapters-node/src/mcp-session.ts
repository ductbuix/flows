import { Readable, Writable } from "node:stream"
import type {
  McpConnect,
  McpSession,
  McpToolInfo,
  ProcessRunner,
  RunningProcess,
  SecretStore,
} from "@workspace/core"
import { tokenSecretKey } from "@workspace/core"
import type { ConnectorFile } from "@workspace/contracts"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"

/** MCP protocol version spoken by the connector client (matches mcp-gateway). */
export const MCP_PROTOCOL_VERSION = "2024-11-05"

export type NodeMcpConnectOptions = {
  runner: ProcessRunner
  secrets?: SecretStore
  fetch?: typeof globalThis.fetch
}

/** Open an MCP session from connector `how` (stdio command or http URL). */
export function createNodeMcpConnect(
  options: NodeMcpConnectOptions
): McpConnect {
  const fetchFn = options.fetch ?? globalThis.fetch
  return async (connector, signal) => {
    const how = connector.how.trim()
    if (isHttpUrl(how)) {
      return openUrlSession(how, connector, options.secrets, fetchFn, signal)
    }
    return openStdioSession(options.runner, how, signal)
  }
}

function isHttpUrl(how: string): boolean {
  return /^https?:\/\//i.test(how)
}

function splitCommand(how: string): { command: string; args: string[] } {
  const parts = how.split(/\s+/).filter((p) => p.length > 0)
  const command = parts[0]
  if (!command) {
    throw new Error("MCP command is empty")
  }
  return { command, args: parts.slice(1) }
}

async function openStdioSession(
  runner: ProcessRunner,
  how: string,
  signal: AbortSignal
): Promise<McpSession> {
  const { command, args } = splitCommand(how)
  const child = new AbortController()
  const onParentAbort = () => child.abort()
  if (signal.aborted) child.abort()
  else signal.addEventListener("abort", onParentAbort, { once: true })

  const proc = runner.spawn({ command, args }, child.signal)
  const peer = peerFromProcess(proc)
  try {
    await handshake(peer)
  } catch (err) {
    peer.close()
    child.abort()
    signal.removeEventListener("abort", onParentAbort)
    throw err
  }
  return sessionFromPeer(peer, () => {
    signal.removeEventListener("abort", onParentAbort)
    peer.close()
    child.abort()
  })
}

function peerFromProcess(proc: RunningProcess): RpcPeer {
  const stdout = Readable.fromWeb(
    proc.stdout as import("node:stream/web").ReadableStream
  )
  const stdin = Writable.fromWeb(
    proc.stdin as import("node:stream/web").WritableStream
  )
  return new RpcPeer(ndjsonTransport(stdout, stdin))
}

async function handshake(peer: RpcPeer): Promise<void> {
  await peer.request("initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "flows-connector", version: "0.0.0" },
  })
  peer.notify("notifications/initialized")
}

function sessionFromPeer(peer: RpcPeer, close: () => void): McpSession {
  return {
    async listTools() {
      const listed = (await peer.request("tools/list", {})) as {
        tools?: Array<{ name?: unknown; description?: unknown }>
      }
      return parseTools(listed?.tools)
    },
    async callTool(name, args) {
      return peer.request("tools/call", { name, arguments: args })
    },
    close,
  }
}

function parseTools(
  tools: Array<{ name?: unknown; description?: unknown }> | undefined
): McpToolInfo[] {
  if (!Array.isArray(tools)) return []
  const out: McpToolInfo[] = []
  for (const t of tools) {
    if (typeof t?.name !== "string" || t.name.length === 0) continue
    const info: McpToolInfo = { name: t.name }
    if (typeof t.description === "string") info.description = t.description
    out.push(info)
  }
  return out
}

async function openUrlSession(
  url: string,
  connector: ConnectorFile,
  secrets: SecretStore | undefined,
  fetchFn: typeof globalThis.fetch,
  signal: AbortSignal
): Promise<McpSession> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  }
  if (connector.auth === "pat" || connector.auth === "oauth") {
    const token = secrets?.get(tokenSecretKey(connector.id))
    if (!token) {
      throw new Error("not signed in")
    }
    headers.authorization = `Bearer ${token}`
  }

  let nextId = 1
  async function rpc(method: string, params?: unknown): Promise<unknown> {
    const id = nextId++
    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        ...(params !== undefined ? { params } : {}),
      }),
      signal,
    })
    if (!res.ok) {
      throw new Error(`mcp http ${res.status}`)
    }
    const body = (await res.json()) as {
      id?: number
      result?: unknown
      error?: { message?: string }
    }
    if (body.error) {
      throw new Error(body.error.message ?? "mcp error")
    }
    return body.result
  }

  await rpc("initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "flows-connector", version: "0.0.0" },
  })

  return {
    async listTools() {
      const listed = (await rpc("tools/list", {})) as {
        tools?: Array<{ name?: unknown; description?: unknown }>
      }
      return parseTools(listed?.tools)
    },
    async callTool(name, args) {
      return rpc("tools/call", { name, arguments: args })
    },
    close() {},
  }
}

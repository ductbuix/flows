import { spawn } from "node:child_process"
import { createInterface } from "node:readline"

/** Minimal MCP tool client used by connectors (DES-026 / BL-054). */
export type McpClient = {
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>
  close: () => Promise<void>
}

export type McpConnectInput = {
  command?: string
  url?: string
}

type JsonRpcSuccess = {
  jsonrpc: "2.0"
  id: number
  result: unknown
}

type JsonRpcError = {
  jsonrpc: "2.0"
  id: number
  error: { code: number; message: string }
}

function parseResponse(line: string, id: number): unknown {
  const msg = JSON.parse(line) as JsonRpcSuccess | JsonRpcError
  if (msg.id !== id) {
    throw new Error(`mcp response id mismatch: expected ${id}, got ${msg.id}`)
  }
  if ("error" in msg && msg.error) {
    throw new Error(msg.error.message)
  }
  if ("result" in msg) return msg.result
  throw new Error("mcp response missing result")
}

/** Line-delimited JSON-RPC over a local command's stdio. */
export async function connectMcpStdio(command: string): Promise<McpClient> {
  const child = spawn(command, {
    shell: true,
    stdio: ["pipe", "pipe", "pipe"],
  })
  if (!child.stdin || !child.stdout) {
    child.kill()
    throw new Error("mcp server failed to start")
  }
  const rl = createInterface({ input: child.stdout })
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >()

  rl.on("line", (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      const msg = JSON.parse(trimmed) as { id?: number }
      if (typeof msg.id !== "number") return
      const wait = pending.get(msg.id)
      if (!wait) return
      pending.delete(msg.id)
      try {
        wait.resolve(parseResponse(trimmed, msg.id))
      } catch (err) {
        wait.reject(err instanceof Error ? err : new Error(String(err)))
      }
    } catch (err) {
      for (const wait of pending.values()) {
        wait.reject(err instanceof Error ? err : new Error(String(err)))
      }
      pending.clear()
    }
  })

  child.on("exit", (code) => {
    const err = new Error(`mcp server exited with code ${code ?? "?"}`)
    for (const wait of pending.values()) wait.reject(err)
    pending.clear()
  })

  async function callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const id = nextId++
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    })
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      child.stdin!.write(`${payload}\n`, (err) => {
        if (err) {
          pending.delete(id)
          reject(err)
        }
      })
    })
  }

  async function close(): Promise<void> {
    rl.close()
    if (!child.killed) child.kill()
  }

  return { callTool, close }
}

/** JSON-RPC tools/call over HTTP POST to a remote MCP URL. */
export async function connectMcpUrl(url: string): Promise<McpClient> {
  let nextId = 1
  async function callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const id = nextId++
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    })
    if (!res.ok) {
      throw new Error(`mcp http ${res.status}`)
    }
    const text = await res.text()
    return parseResponse(text.trim(), id)
  }
  return { callTool, close: async () => undefined }
}

/** Open an MCP client from connection scope (command preferred over URL). */
export async function connectMcp(input: McpConnectInput): Promise<McpClient> {
  const command = input.command?.trim()
  if (command) return connectMcpStdio(command)
  const url = input.url?.trim()
  if (url) return connectMcpUrl(url)
  throw new Error("connection scope needs command or url for MCP")
}

#!/usr/bin/env node
/**
 * Tiny stdio MCP server fixture for connector transport tests (BL-163).
 * Speaks initialize, tools/list, tools/call over line-delimited JSON-RPC.
 */
import { createInterface } from "node:readline"

const tools = [
  {
    name: "echo",
    description: "Echo arguments as text",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
    },
  },
  {
    name: "fail",
    description: "Always errors",
    inputSchema: { type: "object" },
  },
]

const rl = createInterface({ input: process.stdin })

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}

function fail(id, message) {
  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message },
    })}\n`
  )
}

rl.on("line", (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    return
  }
  const { id, method, params } = msg
  if (method === "initialize") {
    reply(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "stub-mcp", version: "0.0.0" },
    })
    return
  }
  if (method === "notifications/initialized") return
  if (method === "tools/list") {
    reply(id, { tools })
    return
  }
  if (method === "tools/call") {
    const name = params?.name
    const args = params?.arguments ?? {}
    if (name === "echo") {
      reply(id, {
        content: [
          {
            type: "text",
            text: typeof args.message === "string" ? args.message : "echo",
          },
        ],
      })
      return
    }
    if (name === "fail") {
      reply(id, {
        content: [{ type: "text", text: "boom" }],
        isError: true,
      })
      return
    }
    fail(id, `unknown tool ${name}`)
    return
  }
  if (typeof id === "number") fail(id, `unknown method ${method}`)
})

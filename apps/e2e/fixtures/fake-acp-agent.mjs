#!/usr/bin/env node
/**
 * Minimal ACP agent for e2e (BL-142). Speaks NDJSON JSON-RPC on stdio;
 * answers session/prompt with one message chunk derived from the prompt.
 */
import { createInterface } from "node:readline"

// Behave like a CLI for probes (Settings, agent/list): only `acp` speaks ACP.
const argv = process.argv.slice(2)
if (argv.includes("--version") || argv.includes("-v")) {
  process.stdout.write("0.0.0-fake-acp\n")
  process.exit(0)
}
if (!argv.includes("acp")) {
  process.stderr.write("fake agent: only `acp` is supported\n")
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
let sessionId = "e2e_sess"

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`)
}

function textFromPrompt(params) {
  const blocks = params?.prompt
  if (!Array.isArray(blocks)) return "ok"
  for (const b of blocks) {
    if (b?.type === "text" && typeof b.text === "string") {
      const line = b.text.trim().split("\n")[0] ?? "ok"
      return `Summary: ${line}`
    }
  }
  return "ok"
}

rl.on("line", (line) => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  const { id, method, params } = msg
  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: false,
          promptCapabilities: {
            image: false,
            audio: false,
            embeddedContext: true,
          },
        },
        agentInfo: { name: "fake-acp-agent", version: "0.0.0" },
        authMethods: [],
      },
    })
    return
  }
  if (method === "authenticate") {
    send({ jsonrpc: "2.0", id, result: {} })
    return
  }
  if (method === "session/new") {
    sessionId = "e2e_sess"
    send({ jsonrpc: "2.0", id, result: { sessionId } })
    return
  }
  if (method === "session/prompt") {
    const text = textFromPrompt(params)
    send({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text },
        },
      },
    })
    send({
      jsonrpc: "2.0",
      id,
      result: { stopReason: "end_turn" },
    })
    return
  }
  if (id !== undefined) {
    send({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    })
  }
})

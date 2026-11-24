#!/usr/bin/env node
/**
 * Minimal ACP agent for e2e (BL-142 / BL-195). Speaks NDJSON JSON-RPC on
 * stdio; answers session/prompt with one message chunk. When the prompt
 * contains ASK_PERMISSION, requests session/request_permission first and
 * waits for the client reply before finishing the turn.
 */
import { createInterface } from "node:readline"

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
let nextClientId = 1
/** @type {Map<number, (msg: object) => void>} */
const pendingClient = new Map()

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

function promptText(params) {
  const blocks = params?.prompt
  if (!Array.isArray(blocks)) return ""
  return blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
}

function requestClient(method, params) {
  const id = nextClientId++
  return new Promise((resolve, reject) => {
    pendingClient.set(id, (msg) => {
      if (msg.error) reject(new Error(msg.error.message ?? "client error"))
      else resolve(msg.result)
    })
    send({ jsonrpc: "2.0", id, method, params })
  })
}

rl.on("line", (line) => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }

  if (msg.id !== undefined && (msg.result !== undefined || msg.error)) {
    const wait = pendingClient.get(msg.id)
    if (wait) {
      pendingClient.delete(msg.id)
      wait(msg)
    }
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
    const finish = () => {
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
    }
    if (promptText(params).includes("ASK_PERMISSION")) {
      void requestClient("session/request_permission", {
        sessionId,
        toolCall: {
          toolCallId: "e2e_tc1",
          title: "Write file",
          kind: "edit",
          status: "pending",
        },
        options: [
          {
            optionId: "allow-once",
            name: "Allow once",
            kind: "allow_once",
          },
        ],
      })
        .then(() => finish())
        .catch((err) => {
          send({
            jsonrpc: "2.0",
            id,
            error: { code: -32000, message: String(err?.message ?? err) },
          })
        })
      return
    }
    finish()
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

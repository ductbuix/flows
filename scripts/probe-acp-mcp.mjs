#!/usr/bin/env node
/**
 * Dev probe: does Cursor `agent acp` honour session/new mcpServers?
 * Out of product path; not part of CI. No secrets.
 *
 * Usage: node scripts/probe-acp-mcp.mjs
 */
import { spawn } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import readline from "node:readline"

const AGENT = process.env.AGENT_BIN ?? `${process.env.HOME}/.local/bin/agent`
const TIMEOUT_MS = 90_000

const workDir = mkdtempSync(join(tmpdir(), "flows-acp-mcp-"))
const markerPath = join(workDir, "mcp-tool-called.txt")
const mcpScript = join(workDir, "trivial-mcp.mjs")
writeFileSync(
  mcpScript,
  `
import { appendFileSync } from "node:fs"
let buf = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  buf += chunk
  let idx
  while ((idx = buf.indexOf("\\n")) >= 0) {
    const line = buf.slice(0, idx)
    buf = buf.slice(idx + 1)
    if (!line.trim()) continue
    let msg
    try { msg = JSON.parse(line) } catch { continue }
    const reply = (result) => {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }) + "\\n")
    }
    if (msg.method === "initialize") {
      reply({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "trivial-mcp", version: "0.0.0" },
      })
      continue
    }
    if (msg.method === "notifications/initialized") continue
    if (msg.method === "tools/list") {
      reply({
        tools: [{
          name: "ping",
          description: "Writes a marker and returns pong",
          inputSchema: { type: "object", properties: {} },
        }],
      })
      continue
    }
    if (msg.method === "tools/call" && msg.params?.name === "ping") {
      appendFileSync(${JSON.stringify(markerPath)}, "called\\n")
      reply({ content: [{ type: "text", text: "pong" }] })
      continue
    }
    if (msg.id != null) {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0", id: msg.id,
        error: { code: -32601, message: "Method not found: " + msg.method },
      }) + "\\n")
    }
  }
})
`.trimStart()
)

const candidates = [
  {
    label: "acp-stdio-full",
    mcpServers: [
      {
        name: "trivial",
        type: "stdio",
        command: process.execPath,
        args: [mcpScript],
        env: [],
      },
    ],
  },
  {
    label: "acp-stdio-env-obj",
    mcpServers: [
      {
        name: "trivial",
        type: "stdio",
        command: process.execPath,
        args: [mcpScript],
        env: {},
      },
    ],
  },
  {
    label: "acp-no-type",
    mcpServers: [
      {
        name: "trivial",
        command: process.execPath,
        args: [mcpScript],
      },
    ],
  },
  {
    label: "empty",
    mcpServers: [],
  },
]

function spawnAgent() {
  const agent = spawn(AGENT, ["acp"], {
    cwd: workDir,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  })
  let nextId = 1
  const pending = new Map()
  const log = []
  const note = (s) => {
    log.push(s)
    console.error(s)
  }
  agent.stderr.on("data", (d) => {
    const t = d.toString().trim()
    if (t) note(`[stderr] ${t.slice(0, 160)}`)
  })
  const rl = readline.createInterface({ input: agent.stdout })
  rl.on("line", (line) => {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    if (msg.id != null && (msg.result !== undefined || msg.error)) {
      const w = pending.get(msg.id)
      if (!w) return
      pending.delete(msg.id)
      msg.error ? w.reject(msg.error) : w.resolve(msg.result)
      return
    }
    if (msg.method === "session/request_permission" && msg.id != null) {
      agent.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            outcome: { outcome: "selected", optionId: "allow-once" },
          },
        }) + "\n"
      )
    }
  })
  const send = (method, params) => {
    const id = nextId++
    agent.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"
    )
    return new Promise((resolve, reject) =>
      pending.set(id, { resolve, reject })
    )
  }
  const close = () => {
    try {
      agent.kill("SIGTERM")
    } catch {
      /* ignore */
    }
    rl.close()
  }
  return { send, note, log, close }
}

const results = []
const deadline = Date.now() + TIMEOUT_MS

async function tryOne(candidate) {
  if (Date.now() > deadline) {
    results.push({ label: candidate.label, ok: false, error: "timeout budget" })
    return
  }
  const { send, note, close } = spawnAgent()
  try {
    const init = await send("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
      clientInfo: { name: "flows-mcp-probe", version: "0.0.0" },
    })
    note(
      `${candidate.label} caps=${JSON.stringify(init.agentCapabilities ?? null)}`
    )
    if ((init.authMethods ?? []).some((m) => m.id === "cursor_login")) {
      await send("authenticate", { methodId: "cursor_login" })
    }
    const session = await send("session/new", {
      cwd: workDir,
      mcpServers: candidate.mcpServers,
    })
    note(`${candidate.label} sessionId=${session.sessionId}`)

    if (candidate.mcpServers.length === 0) {
      results.push({
        label: candidate.label,
        ok: true,
        sessionId: session.sessionId,
        note: "empty mcpServers accepted",
      })
      close()
      return
    }

    const promptResult = await send("session/prompt", {
      sessionId: session.sessionId,
      prompt: [
        {
          type: "text",
          text:
            "Call the MCP tool ping from server trivial now. " +
            "If unavailable reply exactly NO_MCP_TOOL.",
        },
      ],
    })
    const called = existsSync(markerPath)
    results.push({
      label: candidate.label,
      ok: true,
      sessionAccepted: true,
      stopReason: promptResult.stopReason,
      toolCalled: called,
      marker: called ? readFileSync(markerPath, "utf8") : null,
    })
  } catch (err) {
    results.push({
      label: candidate.label,
      ok: false,
      error: err?.message ?? String(err),
      data: err?.data ?? null,
    })
  } finally {
    close()
    try {
      if (existsSync(markerPath)) rmSync(markerPath)
    } catch {
      /* ignore */
    }
  }
}

for (const c of candidates) {
  await tryOne(c)
}

const accepted = results.filter((r) => r.ok && r.label !== "empty")
const toolWorked = accepted.some((r) => r.toolCalled)
const anyAccepted = accepted.length > 0
const emptyOk = results.some((r) => r.label === "empty" && r.ok)

let verdict = "unverified"
let detail = ""
if (toolWorked) {
  verdict = "honoured"
  detail = "mcpServers accepted and ping tool ran"
} else if (anyAccepted) {
  verdict = "unverified"
  detail =
    "session/new accepted a non-empty mcpServers shape but ping marker was not written"
} else if (emptyOk) {
  verdict = "not_honoured"
  detail =
    "empty mcpServers works; every non-empty shape returned Invalid params (or failed)"
} else {
  verdict = "unverified"
  detail = "could not open a session at all"
}

const out = { verdict, detail, results }
console.log(JSON.stringify(out, null, 2))
try {
  rmSync(workDir, { recursive: true, force: true })
} catch {
  /* ignore */
}
process.exit(verdict === "honoured" ? 0 : 2)

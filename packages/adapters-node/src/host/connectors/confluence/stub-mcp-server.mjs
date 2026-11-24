#!/usr/bin/env node
/**
 * Stub Confluence MCP server for tests (BL-054).
 * Line-delimited JSON-RPC tools/call over stdio: get_page, update_page.
 */
import { createInterface } from "node:readline"

const space = process.env.STUB_SPACE ?? "TEAM"
const pageId = process.env.STUB_PAGE ?? "42"
const title = process.env.STUB_TITLE ?? "Stub Page"
let version = Number(process.env.STUB_VERSION ?? "1")
let markdown = process.env.STUB_MARKDOWN ?? "# Stub\n\nHello.\n"
const failConflict = process.env.STUB_CONFLICT === "1"

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
  const id = msg.id
  const name = msg.params?.name
  const args = msg.params?.arguments ?? {}
  if (msg.method !== "tools/call") {
    fail(id, `unknown method ${msg.method}`)
    return
  }
  if (name === "get_page") {
    reply(id, {
      id: pageId,
      title,
      version,
      space: args.space ?? space,
      markdown,
    })
    return
  }
  if (name === "update_page") {
    const base = Number(args.version)
    if (failConflict || base !== version) {
      reply(id, {
        conflict: true,
        message: `version conflict: base ${base}, current ${version}`,
      })
      return
    }
    version += 1
    if (typeof args.markdown === "string") markdown = args.markdown
    reply(id, { version })
    return
  }
  fail(id, `unknown tool ${name}`)
})

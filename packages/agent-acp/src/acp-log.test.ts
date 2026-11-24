import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "@workspace/core/testing"
import { JSONRPC_VERSION, type JsonRpcMessage } from "@workspace/protocol"
import {
  REDACTED,
  documentStoreAcpSink,
  logAcpMessage,
  redactSecrets,
} from "./acp-log.ts"

describe("redactSecrets", () => {
  it("replaces secret substrings in nested values", () => {
    expect(
      redactSecrets({ token: "secret-abc", nested: ["x secret-abc y"] }, [
        "secret-abc",
      ])
    ).toEqual({
      token: REDACTED,
      nested: [`x ${REDACTED} y`],
    })
  })
})

describe("documentStoreAcpSink", () => {
  it("appends redacted JSON-RPC lines to acp.ndjson", () => {
    const docs = createFakeDocumentStore()
    const path = "runs/r-1/steps/llm/acp.ndjson"
    const sink = documentStoreAcpSink(docs, path)
    const secret = "sk-live-123"
    const msg: JsonRpcMessage = {
      jsonrpc: JSONRPC_VERSION,
      method: "authenticate",
      params: { apiKey: secret },
      id: 1,
    }
    logAcpMessage(sink, msg, [secret])
    logAcpMessage(
      sink,
      {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        result: { ok: true },
      },
      [secret]
    )

    const text = docs.read(path)?.text ?? ""
    const lines = text.trimEnd().split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain(REDACTED)
    expect(lines[0]).not.toContain(secret)
    expect(JSON.parse(lines[1]!)).toEqual({
      jsonrpc: JSONRPC_VERSION,
      id: 1,
      result: { ok: true },
    })
  })
})

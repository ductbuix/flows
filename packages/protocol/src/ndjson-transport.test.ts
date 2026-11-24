import { PassThrough } from "node:stream"
import { describe, expect, it, vi } from "vitest"
import { JSONRPC_VERSION, type JsonRpcMessage } from "./json-rpc.ts"
import { ndjsonTransport } from "./ndjson-transport.ts"

const ping: JsonRpcMessage = {
  jsonrpc: JSONRPC_VERSION,
  method: "ping",
  id: 1,
}

const pong: JsonRpcMessage = {
  jsonrpc: JSONRPC_VERSION,
  method: "pong",
  id: 2,
}

function waitMessage(
  transport: ReturnType<typeof ndjsonTransport>
): Promise<JsonRpcMessage> {
  return new Promise((resolve) => {
    const off = transport.onMessage((msg) => {
      off()
      resolve(msg)
    })
  })
}

describe("ndjsonTransport", () => {
  it("sends one JSON line per message", async () => {
    const readable = new PassThrough()
    const writable = new PassThrough()
    const transport = ndjsonTransport(readable, writable)

    const chunks: Buffer[] = []
    writable.on("data", (chunk: Buffer) => chunks.push(chunk))

    transport.send(ping)
    await vi.waitFor(() => expect(chunks.length).toBe(1))
    expect(Buffer.concat(chunks).toString("utf8")).toBe(
      `${JSON.stringify(ping)}\n`
    )
    transport.close()
  })

  it("receives a message split across chunks", async () => {
    const readable = new PassThrough()
    const writable = new PassThrough()
    const transport = ndjsonTransport(readable, writable)
    const received = waitMessage(transport)

    const line = `${JSON.stringify(ping)}\n`
    readable.write(line.slice(0, 8))
    readable.write(line.slice(8))

    await expect(received).resolves.toEqual(ping)
    transport.close()
  })

  it("receives several messages in one chunk", async () => {
    const readable = new PassThrough()
    const writable = new PassThrough()
    const transport = ndjsonTransport(readable, writable)
    const seen: JsonRpcMessage[] = []
    transport.onMessage((msg) => seen.push(msg))

    readable.write(`${JSON.stringify(ping)}\n${JSON.stringify(pong)}\n`)

    await vi.waitFor(() => expect(seen).toEqual([ping, pong]))
    transport.close()
  })

  it("reports a malformed line through onError and keeps working", async () => {
    const readable = new PassThrough()
    const writable = new PassThrough()
    const transport = ndjsonTransport(readable, writable)
    const errors: Error[] = []
    const seen: JsonRpcMessage[] = []
    transport.onError((err) => errors.push(err))
    transport.onMessage((msg) => seen.push(msg))

    readable.write(`not-json\n${JSON.stringify(ping)}\n`)

    await vi.waitFor(() => expect(seen).toEqual([ping]))
    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toMatch(/malformed line/)
    transport.close()
  })

  it("forwards readable end to onClose", async () => {
    const readable = new PassThrough()
    const writable = new PassThrough()
    const transport = ndjsonTransport(readable, writable)
    const closed = new Promise<Error | undefined>((resolve) => {
      transport.onClose((err) => resolve(err))
    })

    readable.end()
    await expect(closed).resolves.toBeUndefined()
  })

  it("round-trips over a linked PassThrough pair", async () => {
    const aToB = new PassThrough()
    const bToA = new PassThrough()
    const a = ndjsonTransport(bToA, aToB)
    const b = ndjsonTransport(aToB, bToA)

    const received = waitMessage(b)
    a.send(ping)
    await expect(received).resolves.toEqual(ping)

    a.close()
    b.close()
  })
})

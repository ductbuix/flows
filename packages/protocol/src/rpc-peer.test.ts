import { describe, expect, it } from "vitest"
import {
  CANCEL_REQUEST_METHOD,
  JSONRPC_INTERNAL_ERROR,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_REQUEST_CANCELLED,
} from "./index.ts"
import { JsonRpcResponseError, TransportClosedError } from "./errors.ts"
import { createLinkedTransports } from "./linked.ts"
import { RpcPeer } from "./rpc-peer.ts"
import type { JsonRpcMessage } from "./json-rpc.ts"

function linkedPeers(): [RpcPeer, RpcPeer] {
  const [a, b] = createLinkedTransports()
  return [new RpcPeer(a), new RpcPeer(b)]
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe("RpcPeer over linked transports", () => {
  it("round-trips a request and a notification", async () => {
    const [client, server] = linkedPeers()
    server.onRequest("ping", (params) => ({ echo: params }))
    const seen: unknown[] = []
    client.onNotification("log", (params) => {
      seen.push(params)
    })

    const result = await client.request("ping", { n: 1 })
    expect(result).toEqual({ echo: { n: 1 } })

    server.notify("log", { line: "ok" })
    await flushMicrotasks()
    expect(seen).toEqual([{ line: "ok" }])
  })

  it("returns -32601 for an unknown method", async () => {
    const [client] = linkedPeers()

    const err = await client.request("missing/method").then(
      () => null as unknown,
      (e: unknown) => e
    )

    expect(err).toBeInstanceOf(JsonRpcResponseError)
    expect((err as JsonRpcResponseError).code).toBe(JSONRPC_METHOD_NOT_FOUND)
  })

  it("maps handler throws to a JSON-RPC error response", async () => {
    const [client, server] = linkedPeers()
    server.onRequest("boom", () => {
      throw new Error("handler failed")
    })

    const err = await client.request("boom").then(
      () => null as unknown,
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(JsonRpcResponseError)
    expect((err as JsonRpcResponseError).code).toBe(JSONRPC_INTERNAL_ERROR)
    expect((err as JsonRpcResponseError).message).toBe("handler failed")
  })

  it("rejects pending requests when the transport closes", async () => {
    const [client, server] = linkedPeers()
    server.onRequest("slow", () => new Promise(() => {}))

    const pending = client.request("slow")
    await flushMicrotasks()
    client.close()
    await flushMicrotasks()

    await expect(pending).rejects.toBeInstanceOf(TransportClosedError)
  })
})

describe("RpcPeer cancellation", () => {
  it("sends $/cancel_request and settles cancelled when aborting before the handler starts", async () => {
    const [clientTransport, serverTransport] = createLinkedTransports()
    const client = new RpcPeer(clientTransport)
    const server = new RpcPeer(serverTransport)
    const cancels: unknown[] = []
    const started: AbortSignal[] = []

    serverTransport.onMessage((msg: JsonRpcMessage) => {
      if ("method" in msg && msg.method === CANCEL_REQUEST_METHOD) {
        cancels.push(msg.params)
      }
    })
    server.onRequest("slow", (_params, ctx) => {
      started.push(ctx.signal)
      return new Promise(() => {})
    })

    const ac = new AbortController()
    const pending = client.request("slow", { n: 1 }, { signal: ac.signal })
    ac.abort()
    await flushMicrotasks()

    const err = await pending.then(
      () => null as unknown,
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(JsonRpcResponseError)
    expect((err as JsonRpcResponseError).code).toBe(JSONRPC_REQUEST_CANCELLED)
    expect((err as JsonRpcResponseError).data).toEqual({ code: "cancelled" })
    expect(cancels).toEqual([{ id: 1 }])
    await flushMicrotasks()
    expect(started.length).toBeLessThanOrEqual(1)
    if (started[0]) expect(started[0].aborted).toBe(true)
  })

  it("aborts ctx.signal after the handler starts and settles cancelled", async () => {
    const [client, server] = linkedPeers()
    let signal!: AbortSignal
    let release!: (value: string) => void

    server.onRequest("slow", (_params, ctx) => {
      signal = ctx.signal
      return new Promise<string>((resolve) => {
        release = resolve
      })
    })

    const ac = new AbortController()
    const pending = client.request("slow", undefined, { signal: ac.signal })
    await flushMicrotasks()
    expect(signal.aborted).toBe(false)

    ac.abort()
    await flushMicrotasks()
    expect(signal.aborted).toBe(true)

    const err = await pending.then(
      () => null as unknown,
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(JsonRpcResponseError)
    expect((err as JsonRpcResponseError).code).toBe(JSONRPC_REQUEST_CANCELLED)
    expect((err as JsonRpcResponseError).data).toEqual({ code: "cancelled" })

    release("late")
    await flushMicrotasks()
    await expect(pending).rejects.toBeInstanceOf(JsonRpcResponseError)
  })

  it("drops a late result after cancel", async () => {
    const [clientTransport, serverTransport] = createLinkedTransports()
    const client = new RpcPeer(clientTransport)
    const server = new RpcPeer(serverTransport)
    const outbound: JsonRpcMessage[] = []
    const originalSend = serverTransport.send.bind(serverTransport)
    serverTransport.send = (msg) => {
      outbound.push(msg)
      originalSend(msg)
    }

    let finish!: (value: string) => void
    server.onRequest("slow", () => {
      return new Promise<string>((resolve) => {
        finish = resolve
      })
    })

    const ac = new AbortController()
    const pending = client.request("slow", undefined, { signal: ac.signal })
    await flushMicrotasks()
    ac.abort()
    await flushMicrotasks()

    await expect(pending).rejects.toMatchObject({
      code: JSONRPC_REQUEST_CANCELLED,
      data: { code: "cancelled" },
    })

    finish("should-drop")
    await flushMicrotasks()

    const results = outbound.filter((m) => "result" in m)
    expect(results).toEqual([])
    const errors = outbound.filter((m) => "error" in m)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      error: {
        code: JSONRPC_REQUEST_CANCELLED,
        data: { code: "cancelled" },
      },
    })
  })
})

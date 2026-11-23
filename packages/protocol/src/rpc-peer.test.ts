import { describe, expect, it } from "vitest"
import { JSONRPC_INTERNAL_ERROR, JSONRPC_METHOD_NOT_FOUND } from "./json-rpc.ts"
import { JsonRpcResponseError, TransportClosedError } from "./errors.ts"
import { createLinkedTransports } from "./linked.ts"
import { RpcPeer } from "./rpc-peer.ts"

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

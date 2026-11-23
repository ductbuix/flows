import {
  defineMethod,
  FCP_VERSION,
  initializeMethod,
  subscribeMethod,
} from "@workspace/contracts"
import {
  createLinkedTransports,
  JSONRPC_INVALID_REQUEST,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { bindEngine, defineBinding } from "./bind.ts"
import { bindInitialize, createFcpConnection } from "./initialize.ts"

function linkedPeers(): [RpcPeer, RpcPeer] {
  const [serverTransport, clientTransport] = createLinkedTransports()
  return [new RpcPeer(serverTransport), new RpcPeer(clientTransport)]
}

const initOpts = {
  engineInfo: { name: "flows-engine", version: "0.0.0-test" },
  workspace: { home: "/tmp/flowapp", id: "ws-1" },
}

const pingMethod = defineMethod({
  name: "ping",
  params: z.object({}),
  result: z.object({ ok: z.literal(true) }),
  kind: "query",
})

function bindLifecycle(
  server: RpcPeer
): ReturnType<typeof createFcpConnection> {
  const connection = createFcpConnection()
  bindInitialize(server, connection, initOpts)
  bindEngine(
    server,
    {
      ping: defineBinding(pingMethod, () => ({ ok: true as const })),
      subscribe: defineBinding(subscribeMethod, () => ({
        seq: 0,
        resync: [],
      })),
    },
    { signal: new AbortController().signal },
    { connection }
  )
  return connection
}

describe("FCP initialize", () => {
  it("returns matching protocolVersion and empty engineCapabilities", async () => {
    const [server, client] = linkedPeers()
    bindLifecycle(server)

    const result = await client.request("initialize", {
      protocolVersion: FCP_VERSION,
      clientInfo: { name: "test-ui", version: "1.0.0" },
      clientCapabilities: {},
    })

    const parsed = initializeMethod.result.parse(result)
    expect(parsed.protocolVersion).toBe(FCP_VERSION)
    expect(parsed.engineInfo).toEqual(initOpts.engineInfo)
    expect(parsed.engineCapabilities).toEqual({ agents: [], nodeKinds: [] })
    expect(parsed.workspace).toEqual(initOpts.workspace)
  })

  it("answers with engine protocolVersion when the client version is older", async () => {
    const [server, client] = linkedPeers()
    bindLifecycle(server)

    const result = await client.request("initialize", {
      protocolVersion: 0,
      clientInfo: { name: "legacy-ui", version: "0.1.0" },
    })

    const parsed = initializeMethod.result.parse(result)
    expect(parsed.protocolVersion).toBe(FCP_VERSION)
  })

  it("rejects other methods before initialize with invalid_request", async () => {
    const [server, client] = linkedPeers()
    bindLifecycle(server)

    try {
      await client.request("ping", {})
      expect.unreachable("expected rejection")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      const rpcErr = err as JsonRpcResponseError
      expect(rpcErr.code).toBe(JSONRPC_INVALID_REQUEST)
      expect(rpcErr.data).toEqual({ code: "invalid_request" })
    }
  })
})

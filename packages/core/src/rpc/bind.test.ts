import { defineMethod, ErrorCode } from "@workspace/contracts"
import {
  createLinkedTransports,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { engineError } from "../kernel/engine-error.ts"
import { createFakeLogger } from "../testing/fake-logger.ts"
import { bindEngine, defineBinding } from "./bind.ts"

function linkedPeers(): [RpcPeer, RpcPeer] {
  const [serverTransport, clientTransport] = createLinkedTransports()
  return [new RpcPeer(serverTransport), new RpcPeer(clientTransport)]
}

const pingMethod = defineMethod({
  name: "ping",
  params: z.object({}),
  result: z.object({ ok: z.literal(true) }),
  kind: "query",
})

const echoMethod = defineMethod({
  name: "sample/echo",
  params: z.object({ text: z.string() }),
  result: z.object({ text: z.string() }),
  kind: "query",
})

describe("bindEngine", () => {
  it("serves a two-method table over linked transports", async () => {
    const [server, client] = linkedPeers()
    const ctx = { signal: new AbortController().signal }

    bindEngine(
      server,
      {
        ping: defineBinding(pingMethod, () => ({ ok: true as const })),
        "sample/echo": defineBinding(echoMethod, (params) => ({
          text: params.text,
        })),
      },
      ctx
    )

    await expect(client.request("ping", {})).resolves.toEqual({ ok: true })
    await expect(
      client.request("sample/echo", { text: "hi" })
    ).resolves.toEqual({ text: "hi" })
  })

  it("returns invalid_params with zod issue paths", async () => {
    const [server, client] = linkedPeers()
    bindEngine(
      server,
      {
        "sample/echo": defineBinding(echoMethod, (params) => ({
          text: params.text,
        })),
      },
      { signal: new AbortController().signal }
    )

    await expect(
      client.request("sample/echo", { text: 1 })
    ).rejects.toMatchObject({
      code: ErrorCode.invalid_params,
      data: {
        code: "invalid_params",
        issues: [{ path: ["text"] }],
      },
    })
  })

  it("maps EngineError to its FCP code", async () => {
    const [server, client] = linkedPeers()
    bindEngine(
      server,
      {
        ping: defineBinding(pingMethod, () => {
          throw engineError("not_found", "missing")
        }),
      },
      { signal: new AbortController().signal }
    )

    try {
      await client.request("ping", {})
      expect.unreachable("expected rejection")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      const rpcErr = err as JsonRpcResponseError
      expect(rpcErr.code).toBe(ErrorCode.not_found)
      expect(rpcErr.data).toEqual({ code: "not_found" })
      expect(rpcErr.message).toBe("missing")
    }
  })

  it("maps unknown throws to internal and logs", async () => {
    const [server, client] = linkedPeers()
    const logger = createFakeLogger()
    bindEngine(
      server,
      {
        ping: defineBinding(pingMethod, () => {
          throw new Error("boom")
        }),
      },
      { signal: new AbortController().signal },
      { logger }
    )

    await expect(client.request("ping", {})).rejects.toMatchObject({
      code: ErrorCode.internal,
      message: "boom",
      data: { code: "internal" },
    })
    expect(logger.entries.some((e) => e.level === "error")).toBe(true)
  })
})

import { FCP_VERSION, docketGetCardMethod } from "@workspace/contracts"
import {
  createLinkedTransports,
  RpcPeer,
  type Transport,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { createClient } from "./client.ts"
import { RetryableConnectionError } from "./errors.ts"
import type { InitializeResult } from "./initialize.ts"

const INIT_RESULT: InitializeResult = {
  protocolVersion: FCP_VERSION,
  engineInfo: { name: "fake-engine", version: "0.0.0" },
  engineCapabilities: { agents: [], nodeKinds: [] },
  workspace: { home: "/tmp/flowapp", id: "ws-1" },
}

function fakeCard(id: string) {
  return {
    id,
    path: `docket/cards/${id}.md`,
    hash: "abc",
    title: "Card",
    status: "todo",
    columnId: "todo",
    rank: "a0",
    refs: [],
    linkCount: 0,
    assetCount: 0,
    missingLinkedAssetCount: 0,
    warnings: [],
    body: "",
    assets: [],
    links: [],
    backlinks: [],
  }
}

function wireFakeEngine(transport: Transport): RpcPeer {
  const peer = new RpcPeer(transport)
  peer.onRequest("initialize", (params) => {
    const p = params as { protocolVersion?: number }
    expect(p.protocolVersion).toBe(FCP_VERSION)
    return INIT_RESULT
  })
  peer.onRequest(docketGetCardMethod.name, (params) => {
    const p = params as { id: string }
    return fakeCard(p.id)
  })
  return peer
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe("createClient", () => {
  it("initializes, queues calls before ready, then returns typed results", async () => {
    const [clientTransport, serverTransport] = createLinkedTransports()
    wireFakeEngine(serverTransport)

    const client = createClient({ transport: clientTransport })
    const pending = client.call("docket/get_card", { id: "c1" })
    const init = await client.ready
    expect(init.workspace.id).toBe("ws-1")
    await expect(pending).resolves.toMatchObject({
      id: "c1",
      hash: "abc",
    })
    client.close()
  })

  it("delivers notifications from the engine", async () => {
    const [clientTransport, serverTransport] = createLinkedTransports()
    const engine = wireFakeEngine(serverTransport)
    const client = createClient({ transport: clientTransport })
    await client.ready

    const seen: unknown[] = []
    client.onNotification("docket/update", (params) => {
      seen.push(params)
    })
    engine.notify("docket/update", {
      seq: 1,
      kind: "card_removed",
      cardId: "c1",
    })
    await flush()
    expect(seen).toEqual([{ seq: 1, kind: "card_removed", cardId: "c1" }])
    client.close()
  })

  it("fails in-flight calls with a retryable error on drop and reconnects", async () => {
    let serverPeer: RpcPeer | undefined
    let dropClientTransport: Transport | undefined
    let connects = 0

    const client = createClient({
      transport: () => {
        connects += 1
        const [clientTransport, serverTransport] = createLinkedTransports()
        dropClientTransport = clientTransport
        serverPeer?.dispose()
        serverPeer = wireFakeEngine(serverTransport)
        return clientTransport
      },
      backoff: { initialMs: 1, maxMs: 5 },
    })
    await client.ready
    expect(connects).toBe(1)

    serverPeer!.onRequest("docket/get_card", () => new Promise(() => {}))
    const hung = client.call("docket/get_card", { id: "hang" })
    await flush()
    dropClientTransport!.close()

    await expect(hung).rejects.toBeInstanceOf(RetryableConnectionError)

    const after = client.call("docket/get_card", { id: "c2" })
    await expect(after).resolves.toMatchObject({ id: "c2" })
    expect(connects).toBeGreaterThanOrEqual(2)
    client.close()
  })
})

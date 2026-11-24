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

type Buffered = {
  seq: number
  notification: string
  params: Record<string, unknown>
}

type SubscribeParams = { topics: string[]; since?: number }

/** Minimal subscribe/replay engine shared across reconnects. */
function createFakeUpdateEngine(options?: { replayBufferSize?: number }) {
  const bufferSize = options?.replayBufferSize ?? 500
  const buffer: Buffered[] = []
  let seq = 0
  let peer: RpcPeer | undefined
  let hangGetCard = false
  const subscribeCalls: SubscribeParams[] = []

  function topicMatches(topic: string, notification: string): boolean {
    const ns = notification.split("/")[0] ?? notification
    return topic === ns || topic.startsWith(`${ns}:`)
  }

  function subscribe(params: SubscribeParams): {
    seq: number
    resync: string[]
  } {
    subscribeCalls.push({ ...params, topics: [...params.topics] })
    const resync: string[] = []
    const bufferMin = buffer[0]?.seq ?? seq + 1
    if (params.since !== undefined) {
      for (const topic of params.topics) {
        if (params.since + 1 < bufferMin) resync.push(topic)
      }
      for (const update of buffer) {
        if (update.seq <= params.since) continue
        if (params.topics.some((t) => topicMatches(t, update.notification))) {
          peer?.notify(update.notification, update.params)
        }
      }
    }
    return { seq, resync }
  }

  return {
    subscribeCalls,
    setHangGetCard(value: boolean) {
      hangGetCard = value
    },
    attach(transport: Transport): RpcPeer {
      peer?.dispose()
      peer = new RpcPeer(transport)
      peer.onRequest("initialize", (params) => {
        const p = params as { protocolVersion?: number }
        expect(p.protocolVersion).toBe(FCP_VERSION)
        return INIT_RESULT
      })
      peer.onRequest(docketGetCardMethod.name, (params) => {
        if (hangGetCard) return new Promise(() => {})
        const p = params as { id: string }
        return fakeCard(p.id)
      })
      peer.onRequest("subscribe", (raw) => subscribe(raw as SubscribeParams))
      peer.onRequest("unsubscribe", () => ({}))
      return peer
    },
    publish(
      notification: string,
      params: Record<string, unknown> & { kind: string }
    ) {
      seq += 1
      const stamped = { ...params, seq }
      const update: Buffered = { seq, notification, params: stamped }
      buffer.push(update)
      while (buffer.length > bufferSize) buffer.shift()
      peer?.notify(update.notification, update.params)
      return update
    },
  }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe("createClient", () => {
  it("initializes, queues calls before ready, then returns typed results", async () => {
    const [clientTransport, serverTransport] = createLinkedTransports()
    createFakeUpdateEngine().attach(serverTransport)

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
    const engine = createFakeUpdateEngine()
    engine.attach(serverTransport)
    const client = createClient({ transport: clientTransport })
    await client.ready

    const seen: unknown[] = []
    client.onNotification("docket/update", (params) => {
      seen.push(params)
    })
    engine.publish("docket/update", {
      kind: "card_removed",
      cardId: "c1",
    })
    await flush()
    expect(seen).toEqual([{ seq: 1, kind: "card_removed", cardId: "c1" }])
    client.close()
  })

  it("fails in-flight calls with a retryable error on drop and reconnects", async () => {
    let dropClientTransport: Transport | undefined
    let connects = 0
    const engine = createFakeUpdateEngine()

    const client = createClient({
      transport: () => {
        connects += 1
        const [clientTransport, serverTransport] = createLinkedTransports()
        dropClientTransport = clientTransport
        engine.attach(serverTransport)
        return clientTransport
      },
      backoff: { initialMs: 1, maxMs: 5 },
    })
    await client.ready
    expect(connects).toBe(1)

    engine.setHangGetCard(true)
    const hung = client.call("docket/get_card", { id: "hang" })
    await flush()
    dropClientTransport!.close()

    await expect(hung).rejects.toBeInstanceOf(RetryableConnectionError)

    engine.setHangGetCard(false)
    const after = client.call("docket/get_card", { id: "c2" })
    await expect(after).resolves.toMatchObject({ id: "c2" })
    expect(connects).toBeGreaterThanOrEqual(2)
    client.close()
  })

  it("resubscribes with last seq and replays updates after reconnect", async () => {
    let dropClientTransport: Transport | undefined
    const engine = createFakeUpdateEngine()

    const client = createClient({
      transport: () => {
        const [clientTransport, serverTransport] = createLinkedTransports()
        dropClientTransport = clientTransport
        engine.attach(serverTransport)
        return clientTransport
      },
      backoff: { initialMs: 1, maxMs: 5 },
    })
    await client.ready

    const seen: number[] = []
    client.onNotification("docket/update", (params) => {
      seen.push((params as { seq: number }).seq)
    })

    await client.call("subscribe", { topics: ["docket"] })
    engine.publish("docket/update", { kind: "card_removed", cardId: "a" })
    engine.publish("docket/update", { kind: "card_removed", cardId: "b" })
    await flush()
    expect(seen).toEqual([1, 2])

    engine.publish("docket/update", { kind: "card_removed", cardId: "c" })
    await flush()
    expect(seen).toEqual([1, 2, 3])

    dropClientTransport!.close()
    engine.publish("docket/update", { kind: "card_removed", cardId: "d" })
    engine.publish("docket/update", { kind: "card_removed", cardId: "e" })

    await expect
      .poll(() => seen.slice(), { timeout: 2000 })
      .toEqual([1, 2, 3, 4, 5])

    const resubscribe = engine.subscribeCalls.find((c) => c.since !== undefined)
    expect(resubscribe).toMatchObject({ topics: ["docket"], since: 3 })
    client.close()
  })

  it("emits resync for topics the engine lists on subscribe", async () => {
    const engine = createFakeUpdateEngine({ replayBufferSize: 2 })
    const [clientTransport, serverTransport] = createLinkedTransports()
    engine.attach(serverTransport)
    engine.publish("docket/update", { kind: "card_removed", cardId: "a" })
    engine.publish("docket/update", { kind: "card_removed", cardId: "b" })
    engine.publish("docket/update", { kind: "card_removed", cardId: "c" })

    const client = createClient({ transport: clientTransport })
    await client.ready

    const resynced: string[] = []
    client.on("resync", (topic) => {
      resynced.push(topic)
    })

    await client.call("subscribe", { topics: ["docket"], since: 0 })
    expect(resynced).toEqual(["docket"])
    client.close()
  })
})

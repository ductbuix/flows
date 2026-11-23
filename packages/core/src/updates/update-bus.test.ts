import { subscribeMethod } from "@workspace/contracts"
import {
  createLinkedTransports,
  RpcPeer,
  type Transport,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import { createSubscribeBindings } from "./bind-subscribe.ts"
import { UpdateBus } from "./update-bus.ts"

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function linkedPeers(): [RpcPeer, RpcPeer, Transport] {
  const [serverTransport, clientTransport] = createLinkedTransports()
  return [
    new RpcPeer(serverTransport),
    new RpcPeer(clientTransport),
    serverTransport,
  ]
}

describe("UpdateBus", () => {
  it("assigns monotonic seq and delivers updates in order", async () => {
    const bus = new UpdateBus()
    const [server, client] = linkedPeers().slice(0, 2) as [RpcPeer, RpcPeer]
    const seen: number[] = []
    client.onNotification("run/update", (params) => {
      const p = params as { seq: number }
      seen.push(p.seq)
    })

    const { bindings, dispose } = createSubscribeBindings(bus, server, "p1")
    bindEngine(server, bindings, { signal: new AbortController().signal })
    await client.request("subscribe", { topics: ["run"] })
    bus.publish("run/update", { kind: "run_changed", runId: "r-1" })
    bus.publish("run/update", { kind: "run_changed", runId: "r-2" })
    await flushMicrotasks()
    expect(bus.currentSeq()).toBe(2)
    expect(seen).toEqual([1, 2])
    dispose.dispose()
  })

  it("replays buffered updates after since", async () => {
    const bus = new UpdateBus({ replayBufferSize: 10 })
    bus.publish("docket/update", { kind: "card_changed", cardId: "c1" })
    bus.publish("docket/update", { kind: "card_changed", cardId: "c2" })
    bus.publish("docket/update", { kind: "card_changed", cardId: "c3" })

    const [server, client] = linkedPeers().slice(0, 2) as [RpcPeer, RpcPeer]
    const cardIds: string[] = []
    client.onNotification("docket/update", (params) => {
      cardIds.push((params as { cardId: string }).cardId)
    })

    const { bindings } = createSubscribeBindings(bus, server, "p1")
    bindEngine(server, bindings, { signal: new AbortController().signal })
    await client.request("subscribe", { topics: ["docket"], since: 1 })
    await flushMicrotasks()
    expect(cardIds).toEqual(["c2", "c3"])
  })

  it("lists topics in resync when since is older than the buffer", async () => {
    const bus = new UpdateBus({ replayBufferSize: 2 })
    bus.publish("inbox/update", { kind: "item_added", itemId: "a" })
    bus.publish("inbox/update", { kind: "item_added", itemId: "b" })
    bus.publish("inbox/update", { kind: "item_added", itemId: "c" })

    const [server, client] = linkedPeers().slice(0, 2) as [RpcPeer, RpcPeer]
    const { bindings } = createSubscribeBindings(bus, server, "p1")
    bindEngine(server, bindings, { signal: new AbortController().signal })
    const result = (await client.request("subscribe", {
      topics: ["inbox"],
      since: 0,
    })) as { seq: number; resync: string[] }
    expect(result.resync).toEqual(["inbox"])
    expect(result.seq).toBe(3)
  })

  it("filters heavy run kinds on the run topic", async () => {
    const bus = new UpdateBus()
    const [server, client] = linkedPeers().slice(0, 2) as [RpcPeer, RpcPeer]
    const kinds: string[] = []
    client.onNotification("run/update", (params) => {
      kinds.push((params as { kind: string }).kind)
    })

    const { bindings } = createSubscribeBindings(bus, server, "p1")
    bindEngine(server, bindings, { signal: new AbortController().signal })
    await client.request("subscribe", { topics: ["run"] })
    bus.publish("run/update", {
      kind: "run_changed",
      runId: "r-1",
    })
    bus.publish("run/update", {
      kind: "log_chunk",
      runId: "r-1",
    })
    bus.publish("run/update", {
      kind: "step_state",
      runId: "r-1",
    })
    await flushMicrotasks()
    expect(kinds).toEqual(["run_changed", "step_state"])
  })

  it("delivers heavy kinds to run:<id> subscribers", async () => {
    const bus = new UpdateBus()
    const [server, client] = linkedPeers().slice(0, 2) as [RpcPeer, RpcPeer]
    const kinds: string[] = []
    client.onNotification("run/update", (params) => {
      kinds.push((params as { kind: string }).kind)
    })

    const { bindings } = createSubscribeBindings(bus, server, "p1")
    bindEngine(server, bindings, { signal: new AbortController().signal })
    await client.request("subscribe", { topics: ["run:r-1"] })
    bus.publish("run/update", { kind: "log_chunk", runId: "r-1" })
    bus.publish("run/update", { kind: "log_chunk", runId: "r-2" })
    await flushMicrotasks()
    expect(kinds).toEqual(["log_chunk"])
  })

  it("unsubscribes a peer when dispose runs after transport close", async () => {
    const bus = new UpdateBus()
    const [server, client, transport] = linkedPeers()
    const seen: unknown[] = []
    client.onNotification("run/update", (params) => {
      seen.push(params)
    })

    const { bindings, dispose } = createSubscribeBindings(bus, server, "p1")
    bindEngine(server, bindings, { signal: new AbortController().signal })
    await client.request("subscribe", { topics: ["run"] })
    transport.close()
    dispose.dispose()
    bus.publish("run/update", { kind: "run_changed", runId: "r-1" })
    await flushMicrotasks()
    expect(seen).toHaveLength(0)
  })

  it("serves subscribe via bindEngine with typed method", async () => {
    const bus = new UpdateBus()
    const [server, client] = linkedPeers().slice(0, 2) as [RpcPeer, RpcPeer]
    const { bindings } = createSubscribeBindings(bus, server, "p1")
    bindEngine(server, bindings, { signal: new AbortController().signal })
    const result = await client.request("subscribe", { topics: ["docket"] })
    expect(subscribeMethod.result.parse(result)).toEqual({
      seq: 0,
      resync: [],
    })
  })
})

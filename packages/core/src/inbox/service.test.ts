import {
  ErrorCode,
  inboxListResultSchema,
  type EngineEvent,
} from "@workspace/contracts"
import {
  createLinkedTransports,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import { RunActor } from "../runs/actor.ts"
import { at, parse } from "../runs/decide-harness.ts"
import { latestStep, type EffectResult } from "../runs/model.ts"
import { createFakeClock, createFakeEventStore } from "../testing/index.ts"
import { createSubscribeBindings } from "../updates/bind-subscribe.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { createInboxBindings } from "./bind.ts"
import { approvalItemId, openInboxItems, projectInbox } from "./projection.ts"
import { createInboxService } from "./service.ts"

const graph = parse(
  [{ id: "ask", kind: "approval", question: "Ship it?" }],
  [{ from: "t", to: "ask" }]
)

function approvalWaitingEvents(runId: string): EngineEvent[] {
  return [
    {
      type: "run_started",
      runId,
      at,
      workflowId: graph.id,
      graph,
      trigger: "t",
      source: "manual",
    },
    {
      type: "step_started",
      runId,
      at,
      nodeId: "ask",
      pass: 1,
    },
    {
      type: "approval_requested",
      runId,
      at,
      taskId: "ask",
      nodeId: "ask",
      pass: 1,
      question: "Ship it?",
    },
  ]
}

describe("inbox projection", () => {
  it("rebuild from events gives the same open items as a live fold", () => {
    const events = createFakeEventStore()
    const bus = new UpdateBus()
    const live = createInboxService({
      bus,
      clock: createFakeClock(Date.parse(at)),
      pushAnswer: async () => {},
      events,
    })

    const appended = events.append("r1", approvalWaitingEvents("r1"), {
      expectSeq: 0,
    })
    expect(appended.ok).toBe(true)
    if (!appended.ok) return
    for (const s of appended.appended) live.apply(s)

    const rebuilt = createInboxService({
      bus: new UpdateBus(),
      clock: createFakeClock(Date.parse(at)),
      pushAnswer: async () => {},
    })
    rebuilt.rebuild(events.read("r1"))

    expect(live.openItems()).toEqual(rebuilt.openItems())
    expect(live.openItems()).toEqual(
      openInboxItems(projectInbox(events.read("r1")))
    )
    expect(live.openItems()[0]).toMatchObject({
      id: approvalItemId("r1", "ask", 1),
      kind: "approval",
      question: "Ship it?",
      workflowId: "wf",
      status: "open",
    })
  })
})

describe("inbox service + run actor", () => {
  it("approval waits appear; answer routes to actor and resolves the item", async () => {
    const events = createFakeEventStore()
    const bus = new UpdateBus()
    const updates: unknown[] = []
    const actor = new RunActor("r1", {
      events,
      runEffect: async (fx): Promise<EffectResult> => {
        if (fx.kind === "post_inbox") {
          return { waiting: true, question: fx.question }
        }
        const node = graph.nodes.find((n) => n.id === fx.nodeId)
        if (node?.kind === "approval") {
          return { waiting: true, question: node.question ?? "Go?" }
        }
        return { ok: true, outputs: [`out/${fx.nodeId}`] }
      },
    })

    const inbox = createInboxService({
      bus,
      clock: createFakeClock(Date.parse(at)),
      events,
      pushAnswer: (input) =>
        actor.push({
          kind: "answer",
          at: input.at,
          nodeId: input.nodeId,
          pass: input.pass,
          decision: input.decision,
        }),
    })

    const [serverTransport, clientTransport] = createLinkedTransports()
    const server = new RpcPeer(serverTransport)
    const client = new RpcPeer(clientTransport)
    client.onNotification("inbox/update", (params) => {
      updates.push(params)
    })
    const { bindings: subBindings, dispose: subDispose } =
      createSubscribeBindings(bus, server, "peer-1")
    bindEngine(
      server,
      { ...createInboxBindings(inbox), ...subBindings },
      { signal: new AbortController().signal }
    )
    await client.request("subscribe", { topics: ["inbox"] })

    await actor.push({ kind: "start", at, runId: "r1", graph })
    for (const s of events.read("r1")) inbox.apply(s)

    expect(latestStep(actor.getState()!.steps, "ask")?.status).toBe("waiting")
    const listed = inboxListResultSchema.parse(
      await client.request("inbox/list", {})
    )
    expect(listed.items).toHaveLength(1)
    const itemId = listed.items[0]!.id
    expect(
      updates.some((u) => (u as { kind: string }).kind === "item_added")
    ).toBe(true)

    await client.request("inbox/answer", { itemId, optionId: "approved" })
    expect(latestStep(actor.getState()!.steps, "ask")?.decision).toBe(
      "approved"
    )
    expect(inbox.openItems()).toEqual([])
    expect(
      updates.some(
        (u) =>
          (u as { kind: string; decision?: string }).kind === "item_resolved" &&
          (u as { decision?: string }).decision === "approved"
      )
    ).toBe(true)

    const rebuilt = projectInbox(events.read("r1"))
    expect(openInboxItems(rebuilt)).toEqual([])
    expect(rebuilt.items.get(itemId)?.decision).toBe("approved")

    subDispose.dispose()
  })

  it("dismiss rejects the approval via the run actor", async () => {
    const events = createFakeEventStore()
    const actor = new RunActor("r1", {
      events,
      runEffect: async (fx): Promise<EffectResult> => {
        if (fx.kind === "post_inbox") {
          return { waiting: true, question: fx.question }
        }
        const node = graph.nodes.find((n) => n.id === fx.nodeId)
        if (node?.kind === "approval") {
          return { waiting: true, question: node.question ?? "Go?" }
        }
        return { ok: true, outputs: [`out/${fx.nodeId}`] }
      },
    })
    const inbox = createInboxService({
      bus: new UpdateBus(),
      clock: createFakeClock(Date.parse(at)),
      events,
      pushAnswer: (input) =>
        actor.push({
          kind: "answer",
          at: input.at,
          nodeId: input.nodeId,
          pass: input.pass,
          decision: input.decision,
        }),
    })

    await actor.push({ kind: "start", at, runId: "r1", graph })
    for (const s of events.read("r1")) inbox.apply(s)
    const itemId = inbox.openItems()[0]!.id
    await inbox.dismiss(itemId)
    expect(latestStep(actor.getState()!.steps, "ask")?.decision).toBe(
      "rejected"
    )
    expect(inbox.openItems()).toEqual([])
  })

  it("answer on a missing item fails with not_found", async () => {
    const inbox = createInboxService({
      bus: new UpdateBus(),
      clock: createFakeClock(Date.parse(at)),
      pushAnswer: async () => {},
    })
    const [serverTransport, clientTransport] = createLinkedTransports()
    const server = new RpcPeer(serverTransport)
    const client = new RpcPeer(clientTransport)
    bindEngine(server, createInboxBindings(inbox), {
      signal: new AbortController().signal,
    })
    try {
      await client.request("inbox/answer", {
        itemId: "approval:missing:ask:1",
        optionId: "approved",
      })
      expect.unreachable("expected not_found")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      const rpcErr = err as JsonRpcResponseError
      expect(rpcErr.code).toBe(ErrorCode.not_found)
      expect(rpcErr.data).toEqual({ code: "not_found" })
    }
  })
})

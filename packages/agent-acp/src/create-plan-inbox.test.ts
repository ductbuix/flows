import { PassThrough } from "node:stream"
import {
  bindEngine,
  createInboxBindings,
  createPlanResult,
  fold,
  foldAll,
  parseCreatePlanParams,
  resolvePlanReview,
} from "@workspace/core"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { describe, expect, it } from "vitest"
import { CURSOR_CREATE_PLAN_METHOD } from "./create-plan.ts"
import {
  at,
  clientInfo,
  cwd,
  nodeId,
  pass,
  planParams,
  runId,
  seedAskRun,
  sessionId,
  setupSteps,
  waitFor,
  wirePlanReviewInbox,
} from "./create-plan-test-helpers.ts"
import { openAcpSession } from "./session.ts"
import { runFakeAgent } from "./testing/fake-agent.ts"

describe("ACP cursor/create_plan (BL-148)", () => {
  it("planReview auto accepts without an Inbox item", async () => {
    expect(resolvePlanReview(undefined)).toBe("auto")
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const agent = runFakeAgent(
      {
        steps: [
          ...setupSteps({
            expect: { method: "session/prompt" },
            hold: true,
            clientRequests: [
              {
                method: CURSOR_CREATE_PLAN_METHOD,
                params: planParams,
                expectResult: createPlanResult("accepted"),
              },
            ],
          }),
          {
            expect: { method: "test/release", notification: true },
            replyHeld: {
              method: "session/prompt",
              reply: { result: { stopReason: "end_turn" } },
            },
            notifyBefore: true,
            notifications: [
              {
                method: "session/update",
                params: {
                  sessionId,
                  update: {
                    sessionUpdate: "agent_message_chunk",
                    content: { type: "text", text: "done" },
                  },
                },
              },
            ],
          },
        ],
      },
      toAgent,
      toClient
    )
    const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
    const session = await openAcpSession(peer, {
      cwd,
      clientInfo,
      handleCreatePlan: async () => createPlanResult("accepted"),
    })
    const promptEvents = (async () => {
      const out = []
      for await (const ev of session.prompt(
        [{ type: "text", text: "hi" }],
        new AbortController().signal
      )) {
        out.push(ev)
      }
      return out
    })()
    peer.notify("test/release", {})
    await expect(promptEvents).resolves.toEqual([
      { kind: "message_chunk", text: "done" },
      { kind: "stop", reason: "end_turn" },
    ])
    await expect(agent.done).resolves.toBeUndefined()
    await session.close()
    peer.close()
  })

  it("planReview ask shows plan+todos; accept returns to agent", async () => {
    const { events, clock, bus } = seedAskRun()
    let runState = foldAll(events.read(runId).map((s) => s.event))
    const { gate, inbox } = wirePlanReviewInbox(events, clock, bus, (ev) => {
      runState = fold(runState, ev)
    })
    const [serverTransport, clientTransport] = createLinkedTransports()
    const server = new RpcPeer(serverTransport)
    const client = new RpcPeer(clientTransport)
    bindEngine(server, createInboxBindings(inbox), {
      signal: new AbortController().signal,
    })
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const agent = runFakeAgent(
      {
        steps: [
          ...setupSteps({
            expect: { method: "session/prompt" },
            hold: true,
            clientRequests: [
              {
                method: CURSOR_CREATE_PLAN_METHOD,
                params: planParams,
                expectResult: createPlanResult("accepted"),
              },
            ],
          }),
          {
            expect: { method: "test/release", notification: true },
            replyHeld: {
              method: "session/prompt",
              reply: { result: { stopReason: "end_turn" } },
            },
            notifyBefore: true,
            notifications: [
              {
                method: "session/update",
                params: {
                  sessionId,
                  update: {
                    sessionUpdate: "agent_message_chunk",
                    content: { type: "text", text: "continued" },
                  },
                },
              },
            ],
          },
        ],
      },
      toAgent,
      toClient
    )
    const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
    const session = await openAcpSession(peer, {
      cwd,
      clientInfo,
      handleCreatePlan: async (params) => {
        const parsed = parseCreatePlanParams(params)
        if (!parsed) throw new Error("bad create_plan params")
        const result = await gate.ask({
          runId,
          nodeId,
          pass,
          requestId: parsed.requestId,
          plan: parsed.plan,
          todos: parsed.todos,
          ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          ...(parsed.overview !== undefined
            ? { overview: parsed.overview }
            : {}),
          at,
        })
        return createPlanResult(result.outcome, result.reason)
      },
    })
    const promptEvents = (async () => {
      const out = []
      for await (const ev of session.prompt(
        [{ type: "text", text: "hi" }],
        new AbortController().signal
      )) {
        out.push(ev)
      }
      return out
    })()
    await waitFor(() => {
      expect(inbox.openItems()).toHaveLength(1)
    })
    const item = inbox.openItems()[0]!
    expect(item).toMatchObject({
      kind: "plan_review",
      requestId: "call_124",
      name: "Refactor tabs",
      plan: planParams.plan,
      status: "open",
    })
    if (item.kind !== "plan_review") throw new Error("expected plan_review")
    expect(item.todos).toEqual(planParams.todos)
    expect(runState?.steps.steps[nodeId]?.[0]?.waitingKind).toBe("plan_review")
    await client.request("inbox/answer", {
      itemId: item.id,
      optionId: "accepted",
    })
    expect(runState?.steps.steps[nodeId]?.[0]?.status).toBe("running")
    expect(inbox.openItems()).toEqual([])
    peer.notify("test/release", {})
    await expect(promptEvents).resolves.toEqual([
      { kind: "message_chunk", text: "continued" },
      { kind: "stop", reason: "end_turn" },
    ])
    await expect(agent.done).resolves.toBeUndefined()
    await session.close()
    peer.close()
  })

  it("planReview ask reject returns rejected to the agent", async () => {
    const { events, clock, bus } = seedAskRun()
    const { gate, inbox } = wirePlanReviewInbox(events, clock, bus)
    const [serverTransport, clientTransport] = createLinkedTransports()
    const server = new RpcPeer(serverTransport)
    const client = new RpcPeer(clientTransport)
    bindEngine(server, createInboxBindings(inbox), {
      signal: new AbortController().signal,
    })
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const agent = runFakeAgent(
      {
        steps: [
          ...setupSteps({
            expect: { method: "session/prompt" },
            hold: true,
            clientRequests: [
              {
                method: CURSOR_CREATE_PLAN_METHOD,
                params: planParams,
                expectResult: createPlanResult("rejected"),
              },
            ],
          }),
          {
            expect: { method: "test/release", notification: true },
            replyHeld: {
              method: "session/prompt",
              reply: { result: { stopReason: "end_turn" } },
            },
          },
        ],
      },
      toAgent,
      toClient
    )
    const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
    const session = await openAcpSession(peer, {
      cwd,
      clientInfo,
      handleCreatePlan: async (params) => {
        const parsed = parseCreatePlanParams(params)
        if (!parsed) throw new Error("bad create_plan params")
        const result = await gate.ask({
          runId,
          nodeId,
          pass,
          requestId: parsed.requestId,
          plan: parsed.plan,
          todos: parsed.todos,
          at,
        })
        return createPlanResult(result.outcome, result.reason)
      },
    })
    const promptEvents = (async () => {
      const out = []
      for await (const ev of session.prompt(
        [{ type: "text", text: "hi" }],
        new AbortController().signal
      )) {
        out.push(ev)
      }
      return out
    })()
    await waitFor(() => {
      expect(inbox.openItems()).toHaveLength(1)
    })
    await client.request("inbox/answer", {
      itemId: inbox.openItems()[0]!.id,
      optionId: "rejected",
    })
    peer.notify("test/release", {})
    await expect(promptEvents).resolves.toEqual([
      { kind: "stop", reason: "end_turn" },
    ])
    await expect(agent.done).resolves.toBeUndefined()
    await session.close()
    peer.close()
  })
})

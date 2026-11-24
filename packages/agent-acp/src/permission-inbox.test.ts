import { PassThrough } from "node:stream"
import {
  bindEngine,
  createInboxBindings,
  createInboxService,
  createPermissionAskGate,
  decidePermission,
  fold,
  foldAll,
  permissionItemId,
  selectedPermissionResult,
  toolFromPermissionParams,
  UpdateBus,
  type PermissionContext,
} from "@workspace/core"
import { createFakeClock, createFakeEventStore } from "@workspace/core/testing"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { describe, expect, it } from "vitest"
import { ACP_CLIENT_CAPABILITIES, openAcpSession } from "./session.ts"
import { runFakeAgent, type FakeAgentStep } from "./testing/fake-agent.ts"

const clientInfo = { name: "flows-test", version: "0.0.0" }
const sessionId = "sess_perm"
const cwd = "/tmp/work"
const at = "2026-11-24T00:00:00.000Z"
const runId = "r1"
const nodeId = "llm"
const pass = 1

const permissionParams = {
  sessionId,
  toolCall: {
    toolCallId: "tc1",
    title: "Write file",
    kind: "edit",
    status: "pending",
  },
  options: [
    { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
    { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
    { optionId: "reject-once", name: "Reject", kind: "reject_once" },
  ],
}

const policyContext: PermissionContext = {
  allowedRoots: ["/tmp/work"],
  connectorWriteEnabled: true,
  nodeAllowlist: [],
  rememberedAllowAlways: [],
}

function setupSteps(promptStep: FakeAgentStep): FakeAgentStep[] {
  return [
    {
      expect: {
        method: "initialize",
        params: {
          protocolVersion: 1,
          clientCapabilities: ACP_CLIENT_CAPABILITIES,
          clientInfo,
        },
      },
      reply: {
        result: {
          protocolVersion: 1,
          agentCapabilities: {},
          agentInfo: { name: "fake", version: "0" },
          authMethods: [],
        },
      },
    },
    {
      expect: {
        method: "session/new",
        params: { cwd, mcpServers: [] },
      },
      reply: { result: { sessionId } },
    },
    promptStep,
  ]
}

async function waitFor(fn: () => void, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  let last: unknown
  while (Date.now() - start < timeoutMs) {
    try {
      fn()
      return
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 10))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

describe("ACP permission → Inbox (BL-146)", () => {
  it("ask parks waiting; inbox/answer allow-once; agent continues", async () => {
    const events = createFakeEventStore()
    const clock = createFakeClock(Date.parse(at))
    const bus = new UpdateBus()

    events.append(
      runId,
      [
        {
          type: "run_started",
          runId,
          at,
          workflowId: "wf",
          graph: {
            id: "wf",
            nodes: [
              { id: "t", kind: "trigger", type: "manual" },
              { id: nodeId, kind: "llm", cli: "cursor" },
            ],
            edges: [{ from: "t", to: nodeId }],
          },
          trigger: "t",
        },
        { type: "step_started", runId, at, nodeId, pass },
      ],
      { expectSeq: 0 }
    )

    let runState = foldAll(events.read(runId).map((s) => s.event))

    const appendAndApply = (
      ev: Parameters<typeof events.append>[1][number]
    ) => {
      const last = events.read(runId).at(-1)?.seq ?? 0
      const result = events.append(runId, [ev], { expectSeq: last })
      if (!result.ok) throw new Error("append conflict")
      for (const s of result.appended) {
        inbox.apply(s)
        runState = fold(runState, s.event)
      }
    }

    const gate = createPermissionAskGate({
      clock,
      onRequested: (event) => {
        appendAndApply(event)
      },
      onAutoReject: async () => {
        throw new Error("autoReject should not fire")
      },
    })

    const inbox = createInboxService({
      bus,
      clock,
      events,
      pushAnswer: async (input) => {
        if (input.kind !== "permission" || !input.requestId) {
          throw new Error("expected permission answer")
        }
        if (
          input.optionId !== "allow-once" &&
          input.optionId !== "allow-always" &&
          input.optionId !== "reject-once"
        ) {
          throw new Error(`bad option ${input.optionId}`)
        }
        gate.answer(
          permissionItemId(
            input.runId,
            input.nodeId,
            input.pass,
            input.requestId
          ),
          input.optionId
        )
        appendAndApply({
          type: "permission_answered",
          runId: input.runId,
          at: input.at,
          nodeId: input.nodeId,
          pass: input.pass,
          requestId: input.requestId,
          optionId: input.optionId,
        })
      },
    })
    for (const s of events.read(runId)) inbox.apply(s)

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
                method: "session/request_permission",
                params: permissionParams,
                expectResult: selectedPermissionResult("allow-once"),
              },
            ],
          }),
          {
            expect: {
              method: "test/release",
              notification: true,
            },
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
      handlePermission: async (params) => {
        const fromParams = toolFromPermissionParams(params)
        expect(
          decidePermission(
            { tool: fromParams.tool, toolKind: fromParams.toolKind },
            policyContext
          ).outcome
        ).toBe("ask")
        const optionId = await gate.ask({
          runId,
          nodeId,
          pass,
          tool: fromParams.tool,
          requestId: fromParams.requestId,
          question: fromParams.question,
          at,
        })
        return selectedPermissionResult(optionId)
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
    expect(inbox.openItems()[0]).toMatchObject({
      kind: "permission",
      tool: "tc1",
      status: "open",
    })
    expect(runState?.steps.steps[nodeId]?.[0]?.status).toBe("waiting")
    expect(runState?.steps.steps[nodeId]?.[0]?.waitingKind).toBe("permission")

    await client.request("inbox/answer", {
      itemId: inbox.openItems()[0]!.id,
      optionId: "allow-once",
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

  it("autoReject rejects and resolves the inbox item", async () => {
    const events = createFakeEventStore()
    const clock = createFakeClock(Date.parse(at))
    const timers: Array<() => void> = []

    events.append(
      runId,
      [
        {
          type: "run_started",
          runId,
          at,
          workflowId: "wf",
          graph: {
            id: "wf",
            nodes: [
              { id: "t", kind: "trigger", type: "manual" },
              { id: nodeId, kind: "llm", cli: "cursor" },
            ],
            edges: [{ from: "t", to: nodeId }],
          },
          trigger: "t",
        },
        { type: "step_started", runId, at, nodeId, pass },
      ],
      { expectSeq: 0 }
    )

    let runState = foldAll(events.read(runId).map((s) => s.event))
    const appendAndApply = (
      ev: Parameters<typeof events.append>[1][number]
    ) => {
      const last = events.read(runId).at(-1)?.seq ?? 0
      const result = events.append(runId, [ev], { expectSeq: last })
      if (!result.ok) throw new Error("append conflict")
      for (const s of result.appended) {
        inbox.apply(s)
        runState = fold(runState, s.event)
      }
    }

    const gate = createPermissionAskGate({
      clock,
      onRequested: (event) => {
        appendAndApply(event)
      },
      onAutoReject: async (input) => {
        gate.answer(input.itemId, "reject-once")
        appendAndApply({
          type: "permission_answered",
          runId: input.runId,
          at: input.at,
          nodeId: input.nodeId,
          pass: input.pass,
          requestId: input.requestId,
          optionId: "reject-once",
        })
      },
      setTimer: (_ms, fn) => {
        timers.push(fn)
        return () => {}
      },
    })

    const inbox = createInboxService({
      bus: new UpdateBus(),
      clock,
      events,
      pushAnswer: async () => {
        throw new Error("manual answer not expected")
      },
    })
    for (const s of events.read(runId)) inbox.apply(s)

    const done = gate.ask({
      runId,
      nodeId,
      pass,
      tool: "tc1",
      requestId: "tc1",
      question: "Write file",
      at,
      autoRejectMs: 25,
    })
    await waitFor(() => {
      expect(inbox.openItems()).toHaveLength(1)
    })
    expect(runState?.steps.steps[nodeId]?.[0]?.status).toBe("waiting")
    expect(timers).toHaveLength(1)
    timers[0]!()
    await expect(done).resolves.toBe("reject-once")
    expect(inbox.openItems()).toEqual([])
    expect(runState?.steps.steps[nodeId]?.[0]?.status).toBe("running")
    expect(
      events.read(runId).some((s) => s.event.type === "permission_answered")
    ).toBe(true)
  })
})

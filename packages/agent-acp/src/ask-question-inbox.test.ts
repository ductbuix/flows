import { PassThrough } from "node:stream"
import {
  askQuestionResult,
  bindEngine,
  createInboxBindings,
  createInboxService,
  createQuestionAskGate,
  fold,
  foldAll,
  parseAskQuestionParams,
  questionItemId,
  UpdateBus,
} from "@workspace/core"
import { createFakeClock, createFakeEventStore } from "@workspace/core/testing"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { describe, expect, it } from "vitest"
import {
  CANCELLED_ASK_QUESTION_RESULT,
  CURSOR_ASK_QUESTION_METHOD,
} from "./ask-question.ts"
import { ACP_CLIENT_CAPABILITIES, openAcpSession } from "./session.ts"
import { runFakeAgent, type FakeAgentStep } from "./testing/fake-agent.ts"

const clientInfo = { name: "flows-test", version: "0.0.0" }
const sessionId = "sess_ask"
const cwd = "/tmp/work"
const at = "2026-11-24T00:00:00.000Z"
const runId = "r1"
const nodeId = "llm"
const pass = 1

const askParams = {
  toolCallId: "call_123",
  title: "Need input",
  questions: [
    {
      id: "q1",
      prompt: "Which mode?",
      options: [
        { id: "agent", label: "Agent" },
        { id: "plan", label: "Plan" },
      ],
    },
    {
      id: "q2",
      prompt: "Tags?",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      allowMultiple: true,
    },
  ],
}

const answeredResult = askQuestionResult("answered", [
  { questionId: "q1", selectedOptionIds: ["plan"] },
  { questionId: "q2", selectedOptionIds: ["a", "b"] },
])

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

describe("ACP cursor/ask_question → Inbox (BL-147)", () => {
  it("one item with questions; multi-select answer; agent continues", async () => {
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

    const gate = createQuestionAskGate({
      clock,
      onRequested: (event) => {
        appendAndApply(event)
      },
    })

    const inbox = createInboxService({
      bus,
      clock,
      events,
      pushAnswer: async (input) => {
        if (input.kind !== "question" || !input.requestId) {
          throw new Error("expected question answer")
        }
        if (input.optionId !== "answered" && input.optionId !== "skipped") {
          throw new Error(`bad option ${input.optionId}`)
        }
        const itemId = questionItemId(
          input.runId,
          input.nodeId,
          input.pass,
          input.requestId
        )
        if (!gate.answer(itemId, input.optionId, input.answers)) {
          throw new Error("gate rejected answer")
        }
        appendAndApply({
          type: "question_answered",
          runId: input.runId,
          at: input.at,
          nodeId: input.nodeId,
          pass: input.pass,
          requestId: input.requestId,
          outcome: input.optionId,
          ...(input.answers ? { answers: input.answers } : {}),
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
                method: CURSOR_ASK_QUESTION_METHOD,
                params: askParams,
                expectResult: answeredResult,
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
      handleAskQuestion: async (params) => {
        const parsed = parseAskQuestionParams(params)
        if (!parsed) throw new Error("bad ask_question params")
        const result = await gate.ask({
          runId,
          nodeId,
          pass,
          requestId: parsed.requestId,
          questions: parsed.questions,
          ...(parsed.title !== undefined ? { title: parsed.title } : {}),
          at,
        })
        return askQuestionResult(result.outcome, result.answers, result.reason)
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
      kind: "question",
      requestId: "call_123",
      title: "Need input",
      status: "open",
    })
    if (item.kind !== "question") throw new Error("expected question")
    expect(item.questions).toHaveLength(2)
    expect(item.questions[1]?.allowMultiple).toBe(true)
    expect(runState?.steps.steps[nodeId]?.[0]?.status).toBe("waiting")
    expect(runState?.steps.steps[nodeId]?.[0]?.waitingKind).toBe("question")

    await client.request("inbox/answer", {
      itemId: item.id,
      optionId: "answered",
      answers: [
        { questionId: "q1", selectedOptionIds: ["plan"] },
        { questionId: "q2", selectedOptionIds: ["a", "b"] },
      ],
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

  it("run cancel answers cursor/ask_question with cancelled", async () => {
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
                method: CURSOR_ASK_QUESTION_METHOD,
                params: askParams,
                expectResult: CANCELLED_ASK_QUESTION_RESULT,
              },
            ],
          }),
          {
            expect: {
              method: "session/cancel",
              params: { sessionId },
              notification: true,
            },
            replyHeld: {
              method: "session/prompt",
              reply: { result: { stopReason: "cancelled" } },
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
      handleAskQuestion: () => new Promise(() => {}),
    })

    const ac = new AbortController()
    const eventsPromise = (async () => {
      const out = []
      for await (const ev of session.prompt(
        [{ type: "text", text: "hi" }],
        ac.signal
      )) {
        out.push(ev)
      }
      return out
    })()

    await new Promise<void>((r) => setTimeout(r, 20))
    ac.abort()
    await expect(eventsPromise).resolves.toEqual([
      { kind: "stop", reason: "cancelled" },
    ])
    await expect(agent.done).resolves.toBeUndefined()
    await session.close()
    peer.close()
  })
})

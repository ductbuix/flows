import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"
import type { AgentEvent } from "@workspace/core"
import { createFakeLogger } from "@workspace/core/testing"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { CANCELLED_PERMISSION_RESULT } from "./cancel.ts"
import {
  runFakeAgent,
  type FakeAgentScript,
  type FakeAgentStep,
} from "./testing/fake-agent.ts"
import {
  ACP_CLIENT_CAPABILITIES,
  openAcpSession,
  toAcpBlock,
  type OpenAcpSessionOptions,
} from "./session.ts"

const clientInfo = { name: "flows-test", version: "0.0.0" }
const sessionId = "sess_test"
const cwd = "/tmp/work"

const initializeParams = {
  protocolVersion: 1,
  clientCapabilities: ACP_CLIENT_CAPABILITIES,
  clientInfo,
}

const initializeResult = {
  protocolVersion: 1,
  agentCapabilities: {
    loadSession: false,
    promptCapabilities: { image: false, audio: false, embeddedContext: true },
  },
  agentInfo: { name: "fake-agent", version: "0.0.0" },
  authMethods: [],
}

function updateNote(update: Record<string, unknown>) {
  return {
    method: "session/update" as const,
    params: { sessionId, update },
  }
}

function setupSteps(promptStep: FakeAgentStep): FakeAgentScript["steps"] {
  return [
    {
      expect: { method: "initialize", params: initializeParams },
      reply: { result: initializeResult },
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

async function collect(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for await (const event of iter) out.push(event)
  return out
}

async function withSession(
  script: FakeAgentScript,
  run: (
    session: Awaited<ReturnType<typeof openAcpSession>>,
    logger: ReturnType<typeof createFakeLogger>
  ) => Promise<void>,
  sessionOpts: Partial<OpenAcpSessionOptions> = {}
): Promise<void> {
  const toAgent = new PassThrough()
  const toClient = new PassThrough()
  const agent = runFakeAgent(script, toAgent, toClient)
  const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
  const logger = createFakeLogger()

  try {
    const session = await openAcpSession(peer, {
      cwd,
      clientInfo,
      logger,
      ...sessionOpts,
    })
    await run(session, logger)
    await expect(agent.done).resolves.toBeUndefined()
  } finally {
    peer.close()
    agent.close()
  }
}

const permissionParams = {
  sessionId,
  toolCall: {
    toolCallId: "tc1",
    title: "Write",
    kind: "edit",
    status: "pending",
  },
  options: [{ optionId: "allow-once", name: "Allow once", kind: "allow_once" }],
}

describe("openAcpSession", () => {
  it("maps each session/update kind and ends on stopReason", async () => {
    await withSession(
      {
        steps: setupSteps({
          expect: {
            method: "session/prompt",
            params: {
              sessionId,
              prompt: [{ type: "text", text: "hi" }],
            },
          },
          reply: { result: { stopReason: "end_turn" } },
          notifyBefore: true,
          notifications: [
            updateNote({
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "Hello" },
            }),
            updateNote({
              sessionUpdate: "agent_thought_chunk",
              content: { type: "text", text: "thinking" },
            }),
            updateNote({
              sessionUpdate: "tool_call",
              toolCallId: "call_1",
              title: "Read file",
              kind: "read",
              status: "pending",
            }),
            updateNote({
              sessionUpdate: "tool_call_update",
              toolCallId: "call_1",
              status: "completed",
              content: [
                { type: "content", content: { type: "text", text: "ok" } },
              ],
            }),
            updateNote({
              sessionUpdate: "plan",
              entries: [
                { content: "Step one", status: "pending", priority: "high" },
              ],
            }),
            updateNote({
              sessionUpdate: "usage_update",
              used: 100,
              size: 1000,
              cost: { amount: 0.01, currency: "USD" },
            }),
          ],
        }),
      },
      async (session) => {
        const events = await collect(
          session.prompt(
            [{ type: "text", text: "hi" }],
            new AbortController().signal
          )
        )
        expect(events).toEqual([
          { kind: "message_chunk", text: "Hello" },
          { kind: "thought_chunk", text: "thinking" },
          {
            kind: "tool_call",
            id: "call_1",
            title: "Read file",
            toolKind: "read",
            status: "pending",
          },
          {
            kind: "tool_call_update",
            id: "call_1",
            status: "completed",
            content: [
              { type: "content", content: { type: "text", text: "ok" } },
            ],
          },
          {
            kind: "plan",
            entries: [
              { content: "Step one", status: "pending", priority: "high" },
            ],
          },
          {
            kind: "usage",
            used: 100,
            size: 1000,
            cost: { amount: 0.01, currency: "USD" },
          },
          { kind: "stop", reason: "end_turn" },
        ])
      }
    )
  })

  it("ignores and logs unknown update kinds", async () => {
    await withSession(
      {
        steps: setupSteps({
          expect: { method: "session/prompt" },
          reply: { result: { stopReason: "refusal" } },
          notifyBefore: true,
          notifications: [
            updateNote({
              sessionUpdate: "available_commands_update",
              availableCommands: [],
            }),
            updateNote({
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "kept" },
            }),
          ],
        }),
      },
      async (session, logger) => {
        const events = await collect(
          session.prompt(
            [{ type: "text", text: "x" }],
            new AbortController().signal
          )
        )
        expect(events).toEqual([
          { kind: "message_chunk", text: "kept" },
          { kind: "stop", reason: "refusal" },
        ])
        expect(
          logger.entries.some(
            (e) =>
              e.level === "warn" &&
              e.message.includes("unknown ACP session update") &&
              e.fields.sessionUpdate === "available_commands_update"
          )
        ).toBe(true)
      }
    )
  })

  it("abort sends session/cancel, cancels pending permission, ends cancelled", async () => {
    await withSession(
      {
        steps: [
          ...setupSteps({
            expect: { method: "session/prompt" },
            hold: true,
            clientRequests: [
              {
                method: "session/request_permission",
                params: permissionParams,
                expectResult: CANCELLED_PERMISSION_RESULT,
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
      async (session) => {
        const ac = new AbortController()
        const iter = session.prompt([{ type: "text", text: "hi" }], ac.signal)
        const eventsPromise = collect(iter)
        await new Promise<void>((r) => setTimeout(r, 20))
        ac.abort()
        await expect(eventsPromise).resolves.toEqual([
          { kind: "stop", reason: "cancelled" },
        ])
      }
    )
  })

  it("kills the process group when the agent ignores cancel past grace", async () => {
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const agent = runFakeAgent(
      {
        steps: [
          ...setupSteps({
            expect: { method: "session/prompt" },
            hold: true,
          }),
          {
            expect: {
              method: "session/cancel",
              params: { sessionId },
              notification: true,
            },
          },
        ],
      },
      toAgent,
      toClient
    )
    const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
    let killCount = 0

    try {
      const session = await openAcpSession(peer, {
        cwd,
        clientInfo,
        cancelGraceMs: 30,
        kill: () => {
          killCount += 1
          peer.close()
        },
      })
      const ac = new AbortController()
      const eventsPromise = collect(
        session.prompt([{ type: "text", text: "hi" }], ac.signal)
      )
      await new Promise<void>((r) => setTimeout(r, 20))
      ac.abort()
      await expect(eventsPromise).resolves.toEqual([
        { kind: "stop", reason: "cancelled" },
      ])
      expect(killCount).toBe(1)
      await expect(agent.done).resolves.toBeUndefined()
    } finally {
      peer.close()
      agent.close()
    }
  })
})

describe("toAcpBlock", () => {
  it("nests resource fields under resource", () => {
    expect(
      toAcpBlock({
        type: "resource",
        uri: "file://a",
        mimeType: "text/plain",
        text: "x",
      })
    ).toEqual({
      type: "resource",
      resource: { uri: "file://a", text: "x", mimeType: "text/plain" },
    })
    expect(toAcpBlock({ type: "text", text: "t" })).toEqual({
      type: "text",
      text: "t",
    })
  })
})

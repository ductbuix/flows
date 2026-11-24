import { PassThrough } from "node:stream"
import type { AgentEvent } from "@workspace/core"
import { mapAgentEventToRunUpdate, type AgentRunUpdate } from "@workspace/core"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { describe, expect, it } from "vitest"
import { ACP_CLIENT_CAPABILITIES, openAcpSession } from "./session.ts"
import { completedTaskResult, CURSOR_TASK_METHOD } from "./task.ts"
import {
  runFakeAgent,
  type FakeAgentScript,
  type FakeAgentStep,
} from "./testing/fake-agent.ts"
import {
  acceptedUpdateTodosResult,
  CURSOR_UPDATE_TODOS_METHOD,
} from "./update-todos.ts"

const clientInfo = { name: "flows-test", version: "0.0.0" }
const sessionId = "sess_todos"
const cwd = "/tmp/work"
const ctx = { runId: "r-1", stepId: "llm" }

const todo1 = {
  id: "1",
  content: "Set up project structure",
  status: "completed" as const,
}
const todo2 = {
  id: "2",
  content: "Add authentication",
  status: "in_progress" as const,
}
const todo2Done = {
  id: "2",
  content: "Add authentication",
  status: "completed" as const,
}
const todo3 = {
  id: "3",
  content: "Write unit tests",
  status: "pending" as const,
}

function setupSteps(promptStep: FakeAgentStep): FakeAgentScript["steps"] {
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

describe("ACP cursor/update_todos and cursor/task (BL-149)", () => {
  it("merge true upserts by id; false replaces; task becomes subagent update", async () => {
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const script: FakeAgentScript = {
      steps: [
        ...setupSteps({
          expect: {
            method: "session/prompt",
            params: {
              sessionId,
              prompt: [{ type: "text", text: "go" }],
            },
          },
          hold: true,
          clientRequests: [
            {
              method: CURSOR_UPDATE_TODOS_METHOD,
              params: {
                toolCallId: "call_125",
                todos: [todo1, todo2],
                merge: false,
              },
              expectResult: acceptedUpdateTodosResult([todo1, todo2]),
            },
            {
              method: CURSOR_UPDATE_TODOS_METHOD,
              params: {
                toolCallId: "call_125b",
                todos: [todo2Done, todo3],
                merge: true,
              },
              expectResult: acceptedUpdateTodosResult([
                todo1,
                todo2Done,
                todo3,
              ]),
            },
            {
              method: CURSOR_TASK_METHOD,
              params: {
                toolCallId: "call_126",
                description: "Explore codebase",
                prompt: "Find auth",
                subagentType: "explore",
                durationMs: 1500,
              },
              expectResult: completedTaskResult({ durationMs: 1500 }),
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
    }
    const agent = runFakeAgent(script, toAgent, toClient)
    const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
    const session = await openAcpSession(peer, { cwd, clientInfo })

    const events: AgentEvent[] = []
    const promptDone = (async () => {
      for await (const ev of session.prompt(
        [{ type: "text", text: "go" }],
        new AbortController().signal
      )) {
        events.push(ev)
      }
    })()

    await waitFor(() => {
      expect(events).toHaveLength(3)
    })
    peer.notify("test/release", {})
    await promptDone

    expect(events).toEqual([
      { kind: "todos", entries: [todo1, todo2] },
      { kind: "todos", entries: [todo1, todo2Done, todo3] },
      {
        kind: "subagent",
        id: "call_126",
        description: "Explore codebase",
        subagentType: "explore",
        durationMs: 1500,
      },
      { kind: "stop", reason: "end_turn" },
    ])

    const updates: AgentRunUpdate[] = []
    for (const event of events) {
      const u = mapAgentEventToRunUpdate(event, ctx)
      if (u) updates.push(u)
    }
    expect(updates).toEqual([
      {
        kind: "todos",
        runId: "r-1",
        stepId: "llm",
        entries: [todo1, todo2],
      },
      {
        kind: "todos",
        runId: "r-1",
        stepId: "llm",
        entries: [todo1, todo2Done, todo3],
      },
      {
        kind: "subagent",
        runId: "r-1",
        stepId: "llm",
        id: "call_126",
        description: "Explore codebase",
        subagentType: "explore",
        durationMs: 1500,
      },
    ])

    await expect(agent.done).resolves.toBeUndefined()
    await session.close()
    peer.close()
  })

  it("accepts cursor/update_todos as a notification", async () => {
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const script: FakeAgentScript = {
      steps: setupSteps({
        expect: {
          method: "session/prompt",
          params: {
            sessionId,
            prompt: [{ type: "text", text: "go" }],
          },
        },
        reply: { result: { stopReason: "end_turn" } },
        notifyBefore: true,
        notifications: [
          {
            method: CURSOR_UPDATE_TODOS_METHOD,
            params: {
              toolCallId: "n1",
              todos: [todo1],
              merge: false,
            },
          },
          {
            method: CURSOR_TASK_METHOD,
            params: {
              toolCallId: "n2",
              description: "Shell check",
              subagentType: "shell",
              durationMs: 40,
            },
          },
        ],
      }),
    }
    const agent = runFakeAgent(script, toAgent, toClient)
    const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
    const session = await openAcpSession(peer, { cwd, clientInfo })
    const events: AgentEvent[] = []
    for await (const ev of session.prompt(
      [{ type: "text", text: "go" }],
      new AbortController().signal
    )) {
      events.push(ev)
    }
    expect(events).toEqual([
      { kind: "todos", entries: [todo1] },
      {
        kind: "subagent",
        id: "n2",
        description: "Shell check",
        subagentType: "shell",
        durationMs: 40,
      },
      { kind: "stop", reason: "end_turn" },
    ])
    await expect(agent.done).resolves.toBeUndefined()
    await session.close()
    peer.close()
  })
})

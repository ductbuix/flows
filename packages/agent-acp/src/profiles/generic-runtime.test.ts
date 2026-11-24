import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"
import type { AgentEvent } from "@workspace/core"
import { createFakeLogger } from "@workspace/core/testing"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { createAcpRuntime } from "../runtime.ts"
import { ACP_CLIENT_CAPABILITIES, openAcpSession } from "../session.ts"
import {
  createScriptedProcessRunner,
  type ScriptedProcessRunner,
} from "../testing/scripted-runner.ts"
import {
  runFakeAgent,
  type FakeAgentScript,
  type FakeAgentStep,
} from "../testing/fake-agent.ts"
import { createGenericProfile } from "./generic.ts"

const clientInfo = { name: "flows-test", version: "0.0.0" }
const cwd = "/tmp/generic-work"
const sessionId = "sess_generic"

const initializeParams = {
  protocolVersion: 1,
  clientCapabilities: ACP_CLIENT_CAPABILITIES,
  clientInfo,
}

const initializeResult = {
  protocolVersion: 1,
  agentCapabilities: {
    loadSession: false,
    promptCapabilities: {
      image: false,
      audio: false,
      embeddedContext: true,
    },
  },
  agentInfo: { name: "fake-generic", version: "0.0.0" },
  authMethods: [],
}

function updateNote(update: Record<string, unknown>) {
  return {
    method: "session/update" as const,
    params: { sessionId, update },
  }
}

async function collect(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for await (const event of iter) out.push(event)
  return out
}

describe("generic ACP profile (BL-150)", () => {
  it("runs a fake agent with only spec methods (no Cursor extensions)", async () => {
    const logger = createFakeLogger()
    const profile = createGenericProfile({
      command: "generic-acp",
      args: ["--stdio"],
      env: ["PATH"],
      logger,
    })

    const promptSteps: FakeAgentStep[] = [
      {
        expect: {
          method: "session/prompt",
          params: {
            sessionId,
            prompt: [{ type: "text", text: "hi" }],
          },
        },
        notifyBefore: true,
        notifications: [
          updateNote({
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "hello" },
          }),
        ],
        reply: { result: { stopReason: "end_turn" } },
      },
    ]

    const runner = createScriptedProcessRunner((): FakeAgentScript => ({
      steps: [
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
        ...promptSteps,
      ],
    }))

    const runtime = createAcpRuntime({
      processRunner: runner,
      profiles: [profile],
      clientInfo,
      logger,
    })

    const session = await runtime.open(
      { profileId: "generic", cwd },
      new AbortController().signal
    )
    expect(session.id).toBe(sessionId)
    expectSpawn(runner, {
      command: "generic-acp",
      args: ["--stdio"],
      cwd,
    })
    expect(runner.spawns[0]!.spec.env?.PATH).toBe(process.env.PATH)

    const events = await collect(
      session.prompt(
        [{ type: "text", text: "hi" }],
        new AbortController().signal
      )
    )
    expect(events).toEqual([
      { kind: "message_chunk", text: "hello" },
      { kind: "stop", reason: "end_turn" },
    ])
    await session.close()

    expect(logger.entries).toContainEqual({
      level: "info",
      message: "ACP generic profile ignores extensions",
      fields: { profileId: "generic" },
    })
  })

  it("does not register Cursor extension handlers on the peer", async () => {
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const agent = runFakeAgent(
      {
        steps: [
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
        ],
        waitForClose: true,
      },
      toAgent,
      toClient
    )
    const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
    try {
      const session = await openAcpSession(peer, {
        cwd,
        clientInfo,
        extensions: {},
      })
      await agent.requestClient({
        method: "cursor/ask_question",
        params: { sessionId, question: "x" },
        expectError: { messageIncludes: "Method not found" },
      })
      agent.close()
      await expect(agent.done).resolves.toBeUndefined()
      await session.close()
    } finally {
      peer.close()
      agent.close()
    }
  })
})

function expectSpawn(
  runner: ScriptedProcessRunner,
  expected: { command: string; args: string[]; cwd: string }
): void {
  expect(runner.spawns).toHaveLength(1)
  const spec = runner.spawns[0]!.spec
  expect(spec.command).toBe(expected.command)
  expect(spec.args).toEqual(expected.args)
  expect(spec.cwd).toBe(expected.cwd)
}

import { PassThrough } from "node:stream"
import { expect } from "vitest"
import type { AgentEvent } from "@workspace/core"
import { createFakeLogger } from "@workspace/core/testing"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import {
  runFakeAgent,
  type FakeAgentScript,
  type FakeAgentStep,
} from "./testing/fake-agent.ts"
import {
  ACP_CLIENT_CAPABILITIES,
  openAcpSession,
  type OpenAcpSessionOptions,
} from "./session.ts"

export const clientInfo = { name: "flows-test", version: "0.0.0" }
export const sessionId = "sess_test"
export const cwd = "/tmp/work"

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

export function updateNote(update: Record<string, unknown>) {
  return {
    method: "session/update" as const,
    params: { sessionId, update },
  }
}

export function setupSteps(
  promptStep: FakeAgentStep
): FakeAgentScript["steps"] {
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

export async function collect(
  iter: AsyncIterable<AgentEvent>
): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for await (const event of iter) out.push(event)
  return out
}

export async function withSession(
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

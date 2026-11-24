import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"
import {
  createRunUpdateCoalescer,
  mapAgentEventToRunUpdate,
  type AgentRunUpdate,
} from "@workspace/core"
import { createFakeDocumentStore } from "@workspace/core/testing"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { documentStoreAcpSink, loggingTransport, REDACTED } from "./acp-log.ts"
import { ACP_CLIENT_CAPABILITIES, openAcpSession } from "./session.ts"
import {
  runFakeAgent,
  type FakeAgentScript,
  type FakeAgentStep,
} from "./testing/fake-agent.ts"

const clientInfo = { name: "flows-test", version: "0.0.0" }
const sessionId = "sess_stream"
const cwd = "/tmp/work"
const secret = "sk-test-secret"
const ctx = { runId: "r-1", stepId: "llm" }
const acpPath = "runs/r-1/steps/llm/acp.ndjson"

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

describe("agent run stream (BL-141)", () => {
  it("scripted session yields coalesced run/update sequence and acp.ndjson", async () => {
    const docs = createFakeDocumentStore()
    const sink = documentStoreAcpSink(docs, acpPath)
    const published: AgentRunUpdate[] = []
    const timers: Array<() => void> = []
    const coalescer = createRunUpdateCoalescer({
      publish: (u) => published.push(u),
      schedule: (cb) => {
        timers.push(cb)
        return () => {
          const i = timers.indexOf(cb)
          if (i >= 0) timers.splice(i, 1)
        }
      },
    })

    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const script: FakeAgentScript = {
      steps: setupSteps({
        expect: {
          method: "session/prompt",
          params: {
            sessionId,
            prompt: [{ type: "text", text: `use ${secret}` }],
          },
        },
        reply: { result: { stopReason: "end_turn" } },
        notifyBefore: true,
        notifications: [
          updateNote({
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Hel" },
          }),
          updateNote({
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "lo" },
          }),
          updateNote({
            sessionUpdate: "tool_call",
            toolCallId: "call_1",
            title: "Read file",
            kind: "read",
            status: "pending",
          }),
          updateNote({
            sessionUpdate: "plan",
            entries: [{ content: "ship it", status: "completed" }],
          }),
        ],
      }),
    }
    const agent = runFakeAgent(script, toAgent, toClient)
    const transport = loggingTransport(
      ndjsonTransport(toClient, toAgent),
      sink,
      [secret]
    )
    const peer = new RpcPeer(transport)

    try {
      const session = await openAcpSession(peer, { cwd, clientInfo })
      for await (const event of session.prompt(
        [{ type: "text", text: `use ${secret}` }],
        new AbortController().signal
      )) {
        const update = mapAgentEventToRunUpdate(event, ctx)
        if (update) coalescer.push(update)
      }
      coalescer.flush()

      expect(published.map((p) => p.kind)).toEqual([
        "agent_message_chunk",
        "tool_call",
        "plan",
      ])
      expect(published[0]).toMatchObject({ text: "Hello" })
      expect(published[1]).toMatchObject({
        kind: "tool_call",
        id: "call_1",
        title: "Read file",
      })
      expect(published[2]).toMatchObject({
        kind: "plan",
        entries: [{ content: "ship it", status: "completed" }],
      })

      const logText = docs.read(acpPath)?.text ?? ""
      expect(logText.length).toBeGreaterThan(0)
      expect(logText).not.toContain(secret)
      expect(logText).toContain(REDACTED)
      const lines = logText.trimEnd().split("\n")
      expect(lines.length).toBeGreaterThanOrEqual(4)
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }

      await expect(agent.done).resolves.toBeUndefined()
    } finally {
      coalescer.dispose()
      peer.close()
      agent.close()
    }
  })
})

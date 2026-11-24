import {
  ACP_CLIENT_CAPABILITIES,
  createScriptedProcessRunner,
  type FakeAgentStep,
} from "@workspace/agent-acp"
import { FCP_VERSION, inboxListMethod } from "@workspace/contracts"
import { getProcessRunner, setProcessRunner } from "@workspace/engine"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createCoreRunHost } from "./core-run-host.ts"
import { openFcpWs, startFcpServer } from "./fcp-harness.ts"

const prevRunner = getProcessRunner()
afterEach(() => {
  setProcessRunner(prevRunner)
})

const sessionId = "sess_inbox_acp"

function baseSteps(extra: FakeAgentStep[]): FakeAgentStep[] {
  return [
    {
      expect: {
        method: "initialize",
        params: {
          protocolVersion: 1,
          clientCapabilities: ACP_CLIENT_CAPABILITIES,
          clientInfo: { name: "flows", version: "0.0.0" },
        },
      },
      reply: {
        result: {
          protocolVersion: 1,
          agentCapabilities: {},
          agentInfo: { name: "fake-agent", version: "0.0.0" },
          authMethods: [],
        },
      },
    },
    {
      expect: { method: "session/new" },
      reply: { result: { sessionId } },
    },
    ...extra,
  ]
}

function writeAcpWorkflow(home: string): void {
  writeFileSync(join(home, "config.yaml"), "agents:\n  runtime: acp\n")
  const dir = join(home, "workflows", "ask")
  mkdirSync(join(dir, "nodes", "l"), { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    `id: ask
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: l, kind: llm, cli: cursor, planReview: ask }
edges:
  - { from: t, to: l }
`
  )
  writeFileSync(join(dir, "nodes", "l", "prompt.md"), "Do the work.\n")
}

async function waitForInbox(
  peer: RpcPeer,
  kind: string,
  timeoutMs = 10_000
): Promise<{ id: string }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const listed = inboxListMethod.result.parse(
      await peer.request("inbox/list", {})
    )
    const item = listed.items.find((i) => i.kind === kind)
    if (item) return item
    await new Promise((r) => setTimeout(r, 40))
  }
  throw new Error(`inbox item kind=${kind} not seen`)
}

describe("inbox/answer → live ACP session (BL-192)", () => {
  it("permission answer reaches the fake agent and clears the item", async () => {
    setProcessRunner(
      createScriptedProcessRunner(() => ({
        steps: baseSteps([
          {
            expect: { method: "session/prompt" },
            hold: true,
            reply: { result: { stopReason: "end_turn" } },
            clientRequests: [
              {
                method: "session/request_permission",
                params: {
                  sessionId,
                  toolCall: {
                    toolCallId: "tc1",
                    title: "Write file",
                    kind: "edit",
                    status: "pending",
                  },
                  options: [
                    {
                      optionId: "allow-once",
                      name: "Allow once",
                      kind: "allow_once",
                    },
                    {
                      optionId: "allow-always",
                      name: "Allow always",
                      kind: "allow_always",
                    },
                    {
                      optionId: "reject-once",
                      name: "Reject",
                      kind: "reject_once",
                    },
                  ],
                },
                expectResult: {
                  outcome: { outcome: "selected", optionId: "allow-once" },
                },
              },
            ],
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
        ]),
      }))
    )

    const h = await startFcpServer()
    writeAcpWorkflow(h.home)

    const socket = await openFcpWs(h.port, h.token)
    const peer = new RpcPeer(wsTransport(socket))
    await peer.request("initialize", {
      protocolVersion: FCP_VERSION,
      clientInfo: { name: "fcp-inbox-acp", version: "0.0.0" },
      clientCapabilities: {},
    })

    await peer.request("run/start", {
      workflowId: "ask",
      requestKey: randomUUID(),
    })

    const item = await waitForInbox(peer, "permission")
    await peer.request("inbox/answer", {
      itemId: item.id,
      optionId: "allow-once",
    })
    const after = inboxListMethod.result.parse(
      await peer.request("inbox/list", {})
    )
    expect(after.items).toEqual([])

    // Let the ACP attempt finish before tearing down the harness.
    await new Promise((r) => setTimeout(r, 200))
    socket.close()
  }, 20_000)

  it("answerAcpAsk fails cleanly when no ask is parked", async () => {
    const h = await startFcpServer()
    const host = createCoreRunHost(h.engine)
    expect(
      host.answerAcpAsk({
        kind: "permission",
        runId: "r1",
        at: new Date().toISOString(),
        nodeId: "l",
        pass: 1,
        requestId: "missing",
        optionId: "allow-once",
      })
    ).toBe(false)
    expect(
      host.answerAcpAsk({
        kind: "question",
        runId: "r1",
        at: new Date().toISOString(),
        nodeId: "l",
        pass: 1,
        requestId: "missing",
        optionId: "skipped",
      })
    ).toBe(false)
    expect(
      host.answerAcpAsk({
        kind: "plan_review",
        runId: "r1",
        at: new Date().toISOString(),
        nodeId: "l",
        pass: 1,
        requestId: "missing",
        optionId: "rejected",
      })
    ).toBe(false)
    host.dispose()
  })
})

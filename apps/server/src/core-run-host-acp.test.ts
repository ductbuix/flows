import {
  ACP_CLIENT_CAPABILITIES,
  createScriptedProcessRunner,
  type FakeAgentStep,
} from "@workspace/agent-acp"
import { parseNodeWorkflowYaml } from "@workspace/contracts"
import {
  createEngine,
  getProcessRunner,
  setProcessRunner,
} from "@workspace/adapters-node"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createCoreRunHost } from "./core-run-host.ts"

const prevRunner = getProcessRunner()
const homes: string[] = []

afterEach(() => {
  setProcessRunner(prevRunner)
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

describe("createCoreRunHost ACP asks (BL-195)", () => {
  it("parks an ACP permission ask and resumes via answerAcpAsk", async () => {
    const sessionId = "sess_core_ask"
    const steps: FakeAgentStep[] = [
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
                content: { type: "text", text: "ok" },
              },
            },
          },
        ],
      },
    ]
    setProcessRunner(createScriptedProcessRunner(() => ({ steps })))

    const home = mkdtempSync(join(tmpdir(), "flowapp-core-acp-"))
    homes.push(home)
    const yaml = `
id: llm-ask
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: l, kind: llm, cli: cursor }
edges:
  - { from: t, to: l }
`
    const dir = join(home, "workflows", "llm-ask")
    mkdirSync(join(dir, "nodes", "l"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), yaml)
    writeFileSync(join(dir, "nodes", "l", "prompt.md"), "Go.\n")

    const engine = createEngine({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!
    const runId = "core-llm-ask"
    expect(await host.tryStart({ graph, runId })).toEqual({ runId })

    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (engine.events(runId).some((e) => e.type === "permission_requested")) {
        break
      }
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(
      engine.events(runId).some((e) => e.type === "permission_requested")
    ).toBe(true)

    expect(
      host.answerAcpAsk({
        kind: "permission",
        runId,
        at: new Date().toISOString(),
        nodeId: "l",
        pass: 1,
        requestId: "tc1",
        optionId: "allow-once",
      })
    ).toBe(true)

    while (Date.now() < deadline) {
      if (engine.getRunSummary(runId)?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary(runId)?.status).toBe("succeeded")
    host.dispose()
    engine.close()
  }, 20_000)
})

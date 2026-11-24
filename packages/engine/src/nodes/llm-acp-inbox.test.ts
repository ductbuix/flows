import {
  ACP_CLIENT_CAPABILITIES,
  createScriptedProcessRunner,
  type FakeAgentStep,
} from "@workspace/agent-acp"
import { createInboxService, UpdateBus } from "@workspace/core"
import { workflowSchema } from "@workspace/shared"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createEngineAcpAsks } from "../acp-asks.ts"
import { EventLog } from "../event-log.ts"
import { appDbPath, workflowDir } from "../paths.ts"
import { getProcessRunner, setProcessRunner } from "../process-runner.ts"
import { runNodes } from "./drive.ts"

const homes: string[] = []
const prevRunner = getProcessRunner()

afterEach(() => {
  setProcessRunner(prevRunner)
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

const sessionId = "sess_llm_inbox"
const clientInfo = { name: "flows", version: "0.0.0" }

function baseSteps(extra: FakeAgentStep[]): FakeAgentStep[] {
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

describe("llm ACP inbox answers (BL-192)", () => {
  it("permission ask parks; answerAcpAsk resumes the agent", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-llm-acp-inbox-"))
    homes.push(home)
    writeFileSync(join(home, "config.yaml"), "agents:\n  runtime: acp\n")
    const wf = workflowDir(home, "wf")
    mkdirSync(join(wf, "nodes", "l"), { recursive: true })
    writeFileSync(join(wf, "nodes", "l", "prompt.md"), "Summarize.\n")

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
        ]),
      }))
    )

    const log = new EventLog(appDbPath(home))
    const asks = createEngineAcpAsks(log)
    const bus = new UpdateBus()
    const clock = { now: () => Date.now() }
    const inbox = createInboxService({
      bus,
      clock,
      events: {
        append: () => ({
          ok: false as const,
          kind: "conflict" as const,
          lastSeq: 0,
        }),
        read: (runId, fromSeq = 0) =>
          log.listByRun(runId).filter((s) => s.seq >= fromSeq),
        tail: () => 0,
      },
      pushAnswer: async (input) => {
        if (input.kind === "approval" || !input.requestId) {
          throw new Error("expected acp answer")
        }
        if (
          !asks.answer({
            kind: input.kind,
            runId: input.runId,
            at: input.at,
            nodeId: input.nodeId,
            pass: input.pass,
            requestId: input.requestId,
            optionId: input.optionId,
            ...(input.answers ? { answers: input.answers } : {}),
          })
        ) {
          throw new Error("no live ask")
        }
      },
    })
    const unsub = log.onAppend((s) => inbox.apply(s))

    const runDone = runNodes({
      log,
      home,
      runId: "r1",
      acpAsks: asks.gates,
      graph: workflowSchema.parse({
        id: "wf",
        nodes: [
          { id: "t", kind: "trigger", type: "manual" },
          { id: "l", kind: "llm", cli: "cursor" },
        ],
        edges: [{ from: "t", to: "l" }],
      }),
      inputText: "story",
    })

    const deadline = Date.now() + 10_000
    while (inbox.openItems().length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(inbox.openItems()).toHaveLength(1)
    expect(inbox.openItems()[0]?.kind).toBe("permission")

    await inbox.answer(inbox.openItems()[0]!.id, "allow-once")
    expect(inbox.openItems()).toEqual([])

    await runDone
    unsub()
    asks.cancelAll()
    log.close()
  })
})

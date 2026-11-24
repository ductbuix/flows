import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  ACP_CLIENT_CAPABILITIES,
  createScriptedProcessRunner,
  type FakeAgentStep,
} from "@workspace/agent-acp"
import { workflowSchema } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { getProcessRunner, setProcessRunner } from "../process-runner.ts"
import { runNodes } from "./drive.ts"
import { latestStep } from "./fold-steps.ts"

const homes: string[] = []
const prevRunner = getProcessRunner()

afterEach(() => {
  setProcessRunner(prevRunner)
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

function sessionId() {
  return "sess_llm"
}

function baseSteps(extra: FakeAgentStep[] = []): FakeAgentStep[] {
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
          agentCapabilities: {
            loadSession: false,
            promptCapabilities: {
              image: false,
              audio: false,
              embeddedContext: true,
            },
          },
          agentInfo: { name: "fake-agent", version: "0.0.0" },
          authMethods: [],
        },
      },
    },
    {
      expect: { method: "session/new" },
      reply: { result: { sessionId: sessionId() } },
    },
    ...extra,
  ]
}

describe("llm ACP runtime", () => {
  it("runs the llm node over ACP when agents.runtime=acp", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-llm-acp-"))
    homes.push(home)
    writeFileSync(join(home, "config.yaml"), "agents:\n  runtime: acp\n")
    const wf = workflowDir(home, "wf")
    mkdirSync(join(wf, "nodes", "l"), { recursive: true })
    writeFileSync(join(wf, "nodes", "l", "prompt.md"), "Summarize.\n")
    writeFileSync(join(wf, "nodes", "l", "system.md"), "Be brief.\n")

    const runner = createScriptedProcessRunner(() => ({
      steps: baseSteps([
        {
          expect: { method: "session/prompt" },
          reply: { result: { stopReason: "end_turn" } },
          notifyBefore: true,
          notifications: [
            {
              method: "session/update",
              params: {
                sessionId: sessionId(),
                update: {
                  sessionUpdate: "agent_message_chunk",
                  content: { type: "text", text: "  acp summary  " },
                },
              },
            },
          ],
        },
      ]),
    }))
    setProcessRunner(runner)

    const log = new EventLog(appDbPath(home))
    const state = await runNodes({
      log,
      home,
      runId: "r1",
      graph: workflowSchema.parse({
        id: "wf",
        nodes: [
          { id: "t", kind: "trigger", type: "manual" },
          { id: "l", kind: "llm", cli: "cursor" },
        ],
        edges: [{ from: "t", to: "l" }],
      }),
      inputText: "a long story",
    })

    log.close()
    expect(latestStep(state, "l")?.status).toBe("done")
    const text = readFileSync(
      join(runDir(wf, "r1"), "nodes/l/pass-1/text.md"),
      "utf8"
    )
    expect(text).toBe("acp summary")
    expect(runner.spawns[0]?.spec.command).toBe("agent")
    expect(runner.spawns[0]?.spec.args).toEqual(["acp"])
  })

  it("keeps the spawn CLI path when agents.runtime is unset", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-llm-spawn-"))
    homes.push(home)
    const wf = workflowDir(home, "wf")
    mkdirSync(join(wf, "nodes", "l"), { recursive: true })
    writeFileSync(join(wf, "nodes", "l", "prompt.md"), "Summarize.\n")
    const bin = join(home, "bin")
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, "claude"),
      ["#!/bin/sh", 'printf "spawned\\n"', ""].join("\n"),
      { mode: 0o755 }
    )
    const prevPath = process.env.PATH
    process.env.PATH = `${bin}:${prevPath ?? ""}`
    try {
      const log = new EventLog(appDbPath(home))
      const state = await runNodes({
        log,
        home,
        runId: "r1",
        graph: workflowSchema.parse({
          id: "wf",
          nodes: [
            { id: "t", kind: "trigger", type: "manual" },
            { id: "l", kind: "llm", cli: "claude" },
          ],
          edges: [{ from: "t", to: "l" }],
        }),
        inputText: "story",
      })
      log.close()
      expect(latestStep(state, "l")?.status).toBe("done")
      expect(
        readFileSync(join(runDir(wf, "r1"), "nodes/l/pass-1/text.md"), "utf8")
      ).toBe("spawned")
    } finally {
      process.env.PATH = prevPath
    }
  })
})

import { describe, expect, it } from "vitest"
import { createFakeAgentRuntime } from "../testing/fake-agent-runtime.ts"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createStepContext } from "./context.ts"
import { agentKind } from "./kinds/agent.ts"
import { collectExecute } from "./run.ts"

describe("agent kind", () => {
  it("runs an ACP session and writes message text", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    docs.write(`${runDir}/nodes/a/frozen/prompt.md`, "Do the thing")
    const runtime = createFakeAgentRuntime().onPrompt(async function* () {
      yield { kind: "message_chunk", text: "done" }
      yield { kind: "stop", reason: "end_turn" }
    })
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "a",
      pass: 1,
      settings: { cli: "cursor" as const },
      inputs: [],
      graph: { id: "wf" },
      agentRuntime: runtime,
    })
    const result = await collectExecute(agentKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: ["nodes/a/pass-1/text.md"],
    })
    expect(docs.read(`${runDir}/nodes/a/pass-1/text.md`)?.text).toBe("done")
  })

  it("fails when prompt.md is missing", async () => {
    const docs = createFakeDocumentStore()
    const runtime = createFakeAgentRuntime()
    const ctx = createStepContext({
      docs,
      runDir: "runs/r1",
      nodeId: "a",
      pass: 1,
      settings: { cli: "cursor" as const },
      inputs: [],
      graph: { id: "wf" },
      agentRuntime: runtime,
    })
    await expect(collectExecute(agentKind.execute(ctx))).resolves.toEqual({
      ok: false,
      reason: "exit",
      message: "missing_prompt",
    })
  })
})

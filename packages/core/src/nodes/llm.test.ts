import { describe, expect, it } from "vitest"
import { createFakeAgentRuntime } from "../testing/fake-agent-runtime.ts"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createStepContext } from "./context.ts"
import { llmKind } from "./kinds/llm.ts"
import { llmContentBlocks, llmPromptText } from "./agent-prompt.ts"
import { createReply } from "./agent-reply.ts"
import { collectExecute } from "./run.ts"

const runDir = "workflows/wf/runs/r1"

describe("llm kind (ACP)", () => {
  it("sends prompt text plus input files as resource blocks", async () => {
    const docs = createFakeDocumentStore()
    docs.write(`${runDir}/nodes/l/frozen/prompt.md`, "Summarize {{topic}}.\n")
    docs.write(`${runDir}/nodes/l/frozen/system.md`, "Be brief.\n")
    const runtime = createFakeAgentRuntime().onPrompt(async function* () {
      yield { kind: "message_chunk", text: "  a summary  " }
      yield { kind: "stop", reason: "end_turn" }
    })
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "l",
      pass: 1,
      settings: { cli: "cursor" as const, model: "composer-1" },
      inputs: [
        {
          from: "t",
          path: `${runDir}/nodes/t/pass-1/text.md`,
          name: "text.md",
          text: "a long story",
        },
        {
          from: "t",
          path: `${runDir}/nodes/t/pass-1/files/note.txt`,
          name: "files/note.txt",
          text: "note body",
        },
      ],
      answers: { topic: "weather" },
      graph: { id: "wf" },
      agentRuntime: runtime,
      agentCwd: "/tmp/step",
    })
    const result = await collectExecute(llmKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: ["nodes/l/pass-1/text.md"],
    })
    expect(docs.read(`${runDir}/nodes/l/pass-1/text.md`)?.text).toBe(
      "a summary"
    )
    expect(runtime.opens).toEqual([
      {
        profileId: "cursor",
        cwd: "/tmp/step",
        mode: "agent",
        model: "composer-1",
      },
    ])
    expect(runtime.prompts[0]?.blocks).toEqual(
      llmContentBlocks(
        llmPromptText({
          system: "Be brief.",
          prompt: "Summarize weather.",
        }),
        ctx.inputs,
        "l"
      )
    )
    expect(runtime.prompts[0]?.blocks).toContainEqual({
      type: "resource",
      uri: "flows://nodes/t/text.md",
      mimeType: "text/markdown",
      text: "a long story",
    })
  })

  it("fails when prompt.md is missing", async () => {
    const docs = createFakeDocumentStore()
    const runtime = createFakeAgentRuntime()
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "l",
      pass: 1,
      settings: { cli: "cursor" as const },
      inputs: [],
      graph: { id: "wf" },
      agentRuntime: runtime,
    })
    await expect(collectExecute(llmKind.execute(ctx))).resolves.toEqual({
      ok: false,
      reason: "exit",
      message: "missing_prompt",
    })
    expect(runtime.opens).toHaveLength(0)
  })
})

describe("llmPromptText / llmContentBlocks", () => {
  it("skips empty input files", () => {
    const blocks = llmContentBlocks("P\n", [
      { from: "t", path: "p", name: "text.md", text: "" },
    ])
    expect(blocks).toEqual([{ type: "text", text: "P\n" }])
  })

  it("joins system and prompt", () => {
    expect(llmPromptText({ system: "S", prompt: "P\n" })).toBe("S\n\nP\n")
    expect(llmPromptText({ prompt: "P" })).toBe("P\n")
  })
})

describe("createReply", () => {
  it("keeps the last message and logs narration before tool calls", () => {
    const logged: string[] = []
    const reply = createReply((t) => logged.push(t))
    reply.push({ kind: "message_chunk", text: "Let me " })
    reply.push({ kind: "message_chunk", text: "check." })
    reply.push({
      kind: "tool_call",
      id: "1",
      title: "ls",
      toolKind: "execute",
      status: "pending",
    })
    reply.push({ kind: "message_chunk", text: " ok " })
    expect(reply.final()).toBe("ok")
    expect(logged).toEqual(["Let me check."])
  })

  it("falls back to the message before a trailing tool call", () => {
    const reply = createReply()
    reply.push({ kind: "message_chunk", text: "done" })
    reply.push({
      kind: "tool_call",
      id: "1",
      title: "save",
      toolKind: "edit",
      status: "pending",
    })
    expect(reply.final()).toBe("done")
  })
})

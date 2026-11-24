import { describe, expect, it } from "vitest"
import type { ContentBlock } from "../ports/agent-runtime.ts"
import { createFakeAgentRuntime } from "../testing/fake-agent-runtime.ts"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createFakeEventStore } from "../testing/fake-event-store.ts"
import { RunActor } from "../runs/actor.ts"
import { at, parse } from "../runs/decide-harness.ts"
import { latestStep } from "../runs/model.ts"
import { createNodeEffectRunner } from "./run.ts"

const runDir = "workflows/wf/runs/r1"

function resources(blocks: readonly ContentBlock[]) {
  return blocks.flatMap((b) =>
    b.type === "resource" ? [{ uri: b.uri, text: b.text }] : []
  )
}

describe("data passing through a judge loop (DES-034)", () => {
  it("passes final results and judge feedback, never logs", async () => {
    const docs = createFakeDocumentStore()
    docs.write(`${runDir}/nodes/llm/frozen/prompt.md`, 'Print "ok".\n')
    docs.write(`${runDir}/nodes/j/frozen/rule.md`, 'Is it "ok"?\n')
    let llmCalls = 0
    const runtime = createFakeAgentRuntime().onPrompt(async function* (p) {
      if (p.spec.mode === "agent") {
        llmCalls++
        yield { kind: "message_chunk", text: "I'll run a command." }
        yield {
          kind: "tool_call",
          id: `t${llmCalls}`,
          title: "Run",
          toolKind: "execute",
          status: "pending",
        }
        yield { kind: "message_chunk", text: llmCalls === 1 ? "not ok" : "ok" }
      } else {
        const input = resources(p.blocks).find((r) =>
          r.uri.endsWith("/llm/text.md")
        )
        yield { kind: "message_chunk", text: "Checking." }
        yield {
          kind: "tool_call",
          id: "j",
          title: "Read",
          toolKind: "read",
          status: "pending",
        }
        yield {
          kind: "message_chunk",
          text: input?.text === "ok" ? "yes" : "no, it printed not ok",
        }
      }
      yield { kind: "stop", reason: "end_turn" }
    })
    const actor = new RunActor("r1", {
      events: createFakeEventStore(),
      runEffect: createNodeEffectRunner({
        docs,
        runDirOf: () => runDir,
        agentRuntime: runtime,
        agentCwdOf: () => "/tmp/work",
      }),
    })
    const graph = parse(
      [
        { id: "llm", kind: "llm", cli: "cursor" },
        { id: "j", kind: "judge", mode: "rule", cli: "cursor" },
        { id: "out", kind: "output", target: "folder" },
      ],
      [
        { from: "t", to: "llm" },
        { from: "llm", to: "j" },
        { from: "j", to: "out", branch: "yes" },
        { from: "j", to: "llm", branch: "no" },
      ]
    )
    await actor.push({ kind: "start", at, runId: "r1", graph })
    const state = actor.getState()!
    expect(state.status).toBe("succeeded")
    expect(latestStep(state.steps, "llm")?.pass).toBe(2)

    // Result is the last message, not the narration before the tool call.
    expect(docs.read(`${runDir}/nodes/llm/pass-1/text.md`)?.text).toBe("not ok")
    expect(docs.read(`${runDir}/nodes/j/pass-1/text.md`)?.text).toBe(
      "no, it printed not ok"
    )

    // Judge pass 1 sees only the llm result.
    const judge1 = runtime.prompts[1]!
    expect(resources(judge1.blocks)).toEqual([
      { uri: "flows://nodes/llm/text.md", text: "not ok" },
    ])

    // llm pass 2 gets its previous result and the judge's feedback.
    const llm2 = runtime.prompts[2]!
    expect(resources(llm2.blocks)).toEqual([
      { uri: "flows://nodes/llm/text.md", text: "not ok" },
      { uri: "flows://nodes/j/text.md", text: "no, it printed not ok" },
    ])
    const list = llm2.blocks[1]
    expect(list?.type === "text" && list.text).toContain(
      "flows://nodes/llm/text.md: your previous result"
    )
    expect(list?.type === "text" && list.text).toContain(
      "flows://nodes/j/text.md: feedback from judge j"
    )
    expect(JSON.stringify(llm2.blocks)).not.toContain("events.log")

    // The folder output gets the gated result, not the verdict.
    expect(docs.read(`${runDir}/output/llm/text.md`)?.text).toBe("ok")
    expect(docs.list(`${runDir}/output/**`)).toEqual([
      `${runDir}/output/llm/text.md`,
    ])
  })
})

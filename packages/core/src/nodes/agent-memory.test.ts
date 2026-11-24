import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import {
  agentAnswerPrompt,
  settleAnswer,
  readStepAnswer,
} from "./agent-answer.ts"
import { copyAgentMemories } from "./agent-memory.ts"
import { parseAnswerText } from "@workspace/contracts"

describe("agent memory and answer settle", () => {
  it("copies listed memory files into input/memory/", () => {
    const docs = createFakeDocumentStore()
    docs.write("workflows/wf/memory/style.md", "# style\n")
    docs.write("workflows/wf/memory/other.md", "# other\n")
    copyAgentMemories(
      docs,
      "workflows/wf",
      "workflows/wf/runs/r1/nodes/a/pass-1",
      ["memory/style.md"]
    )
    expect(
      docs.read("workflows/wf/runs/r1/nodes/a/pass-1/input/memory/style.md")
        ?.text
    ).toBe("# style\n")
    expect(
      docs.read("workflows/wf/runs/r1/nodes/a/pass-1/input/memory/other.md")
    ).toBeNull()
  })

  it("settles a valid answer and records a fix on mismatch", () => {
    const docs = createFakeDocumentStore()
    const stepDir = "runs/r1/nodes/a/pass-1"
    const decls = [
      { name: "risk", type: "choice" as const, labels: ["low", "high"] },
    ]
    docs.write(`${stepDir}/out/answer.json`, '{"risk":"low"}')
    const ok = settleAnswer(
      docs,
      stepDir,
      decls,
      readStepAnswer(docs, stepDir, decls)
    )
    expect(ok).toEqual({ ok: true, answer: { risk: "low" } })

    const bad = settleAnswer(
      docs,
      stepDir,
      decls,
      parseAnswerText(decls, '{"risk":"mid"}')
    )
    expect(bad).toMatchObject({ ok: false, fix: true })
    expect(agentAnswerPrompt(decls)).toContain("out/answer.json")
  })
})

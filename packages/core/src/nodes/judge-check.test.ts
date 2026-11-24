import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createStepContext } from "./context.ts"
import { judgeCheckKind } from "./kinds/judge-check.ts"
import { collectExecute } from "./run.ts"

const runDir = "workflows/wf/runs/r1"

describe("judge check kind", () => {
  it("takes yes or no from evaluateCheck with no agent call", async () => {
    const docs = createFakeDocumentStore()
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "j",
      pass: 1,
      settings: {
        mode: "check" as const,
        check: { field: "score", operator: ">" as const, value: 1 },
      },
      inputs: [
        {
          from: "t",
          path: `${runDir}/nodes/t/pass-1/text.md`,
          name: "text.md",
          text: "payload",
        },
      ],
      answers: { score: 3 },
      graph: { id: "wf" },
    })
    await expect(collectExecute(judgeCheckKind.execute(ctx))).resolves.toEqual({
      ok: true,
      outputs: ["nodes/j/pass-1/text.md"],
      branch: "yes",
    })
    const verdict = docs.read(`${runDir}/nodes/j/pass-1/text.md`)?.text
    expect(verdict).toContain("Check passed: score > 1")
    expect(verdict).not.toContain("payload")

    const no = createStepContext({
      docs,
      runDir,
      nodeId: "j2",
      pass: 1,
      settings: {
        mode: "check" as const,
        check: { field: "score", operator: ">" as const, value: 10 },
      },
      inputs: [],
      answers: { score: 3 },
      graph: { id: "wf" },
    })
    await expect(collectExecute(judgeCheckKind.execute(no))).resolves.toEqual({
      ok: true,
      outputs: ["nodes/j2/pass-1/text.md"],
      branch: "no",
    })
  })

  it("logs the check result to the attempt", async () => {
    const docs = createFakeDocumentStore()
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "j",
      pass: 1,
      attempt: 1,
      settings: {
        mode: "check" as const,
        check: { field: "score", operator: ">" as const, value: 10 },
      },
      inputs: [],
      answers: { score: 3 },
      graph: { id: "wf" },
    })
    await collectExecute(judgeCheckKind.execute(ctx))
    const log = docs.read(`${runDir}/nodes/j/pass-1/attempt-1/events.log`)
    const entry = JSON.parse(log?.text.trim() ?? "{}")
    expect(entry).toMatchObject({
      kind: "message",
      status: "failed",
      title: "Check failed: score > 10",
    })
    expect(entry.text).toContain("score = 3")
  })
})

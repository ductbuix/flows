import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createStepContext, loadRunInputs } from "./context.ts"
import { triggerKind } from "./kinds/trigger.ts"
import { collectExecute } from "./run.ts"

describe("trigger kind", () => {
  it("emits run input text and files as step outputs", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    docs.write(`${runDir}/input/text.md`, "hello")
    docs.write(`${runDir}/input/files/a.txt`, "A")
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "t",
      pass: 1,
      settings: { type: "manual" as const },
      inputs: loadRunInputs(docs, runDir),
      graph: { id: "wf" },
    })
    const result = await collectExecute(triggerKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: ["nodes/t/pass-1/text.md", "nodes/t/pass-1/files/a.txt"],
    })
    expect(docs.read(`${runDir}/nodes/t/pass-1/text.md`)?.text).toBe("hello")
    expect(docs.read(`${runDir}/nodes/t/pass-1/files/a.txt`)?.text).toBe("A")
  })

  it("writes empty text.md when the run has no input", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "t",
      pass: 1,
      settings: { type: "manual" as const },
      inputs: [],
      graph: { id: "wf" },
    })
    const result = await collectExecute(triggerKind.execute(ctx))
    expect(result).toMatchObject({
      ok: true,
      outputs: ["nodes/t/pass-1/text.md"],
    })
    expect(docs.read(`${runDir}/nodes/t/pass-1/text.md`)?.text).toBe("")
  })
})

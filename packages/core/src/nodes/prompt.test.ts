import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createStepContext } from "./context.ts"
import { promptKind } from "./kinds/prompt.ts"
import { collectExecute } from "./run.ts"

describe("prompt kind", () => {
  it("writes filled frozen text.md as the step output", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    docs.write(`${runDir}/nodes/p/frozen/text.md`, "Hello {{name}}")
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "p",
      pass: 1,
      settings: {},
      inputs: [],
      answers: { name: "Ada" },
      graph: { id: "wf" },
    })
    const result = await collectExecute(promptKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: ["nodes/p/pass-1/text.md"],
    })
    expect(docs.read(`${runDir}/nodes/p/pass-1/text.md`)?.text).toBe(
      "Hello Ada"
    )
  })

  it("uses inline text when frozen file is missing", async () => {
    const docs = createFakeDocumentStore()
    const ctx = createStepContext({
      docs,
      runDir: "runs/r1",
      nodeId: "p",
      pass: 1,
      settings: { text: "static" },
      inputs: [],
      graph: { id: "wf" },
    })
    const result = await collectExecute(promptKind.execute(ctx))
    expect(result).toMatchObject({
      ok: true,
      outputs: ["nodes/p/pass-1/text.md"],
    })
    expect(docs.read("runs/r1/nodes/p/pass-1/text.md")?.text).toBe("static")
  })
})

import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { loadStepInputs } from "./context.ts"

describe("loadStepInputs", () => {
  it("reads recorded results and files/, never logs or scratch", () => {
    const docs = createFakeDocumentStore()
    const base = "runs/r1/nodes/a/pass-1"
    docs.write(`${base}/text.md`, "hello")
    docs.write(`${base}/files/out.txt`, "file")
    docs.write(`${base}/scratch.py`, "print()")
    docs.write(`${base}/.keep`, "")
    docs.write(`${base}/attempt-1/events.log`, "{}")
    docs.write(`${base}/attempt-1/stdout.log`, "x")
    const inputs = loadStepInputs(docs, "runs/r1", [
      {
        from: "a",
        pass: 1,
        outputs: ["nodes/a/pass-1/text.md"],
        role: "result",
      },
    ])
    expect(inputs.map((i) => i.name)).toEqual(["text.md", "files/out.txt"])
    expect(inputs[0]).toMatchObject({
      from: "a",
      text: "hello",
      role: "result",
    })
  })

  it("reads only text.md when no outputs were recorded", () => {
    const docs = createFakeDocumentStore()
    docs.write("runs/r1/nodes/a/pass-2/text.md", "two")
    docs.write("runs/r1/nodes/a/pass-2/answer.md", "old layout")
    const inputs = loadStepInputs(docs, "runs/r1", [
      { from: "a", pass: 2, role: "feedback" },
    ])
    expect(inputs).toEqual([
      {
        from: "a",
        path: "runs/r1/nodes/a/pass-2/text.md",
        name: "text.md",
        text: "two",
        role: "feedback",
      },
    ])
  })
})

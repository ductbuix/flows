import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { loadStepInputs } from "./context.ts"

describe("loadStepInputs", () => {
  it("skips per-attempt logs of the upstream step", () => {
    const docs = createFakeDocumentStore()
    const base = "runs/r1/nodes/a/pass-1"
    docs.write(`${base}/text.md`, "hello")
    docs.write(`${base}/attempt-1/events.log`, "{}")
    docs.write(`${base}/attempt-1/stdout.log`, "x")
    const names = loadStepInputs(docs, "runs/r1", ["a"], () => 1).map(
      (i) => i.name
    )
    expect(names).toEqual(["text.md"])
  })
})

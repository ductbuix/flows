import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import type { RunState } from "../runs/model.ts"
import { runWriteOutputEffect } from "./write-output-effect.ts"

function stateOf(): RunState {
  return {
    runId: "r1",
    workflowId: "wf",
    status: "running",
    graph: {
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        { id: "o", kind: "output", target: "folder" },
      ],
      edges: [{ from: "t", to: "o" }],
    },
    steps: {
      steps: {
        t: [
          {
            nodeId: "t",
            pass: 1,
            status: "done",
            attempts: 1,
            outputs: ["nodes/t/pass-1/text.md"],
            seq: 1,
          },
        ],
      },
      ended: false,
    },
    seq: 1,
  }
}

describe("runWriteOutputEffect", () => {
  it("copies upstream step files into run output/", () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    docs.write(`${runDir}/nodes/t/pass-1/text.md`, "hello")
    docs.write(`${runDir}/nodes/t/pass-1/files/a.txt`, "A")
    const result = runWriteOutputEffect(
      { kind: "write_output", nodeId: "o", pass: 1, from: ["t"] },
      stateOf(),
      { docs, runDirOf: () => runDir }
    )
    expect(result).toMatchObject({ ok: true })
    expect(new Set((result as { outputs: string[] }).outputs)).toEqual(
      new Set(["output/t/text.md", "output/t/files/a.txt"])
    )
    expect(docs.read(`${runDir}/output/t/text.md`)?.text).toBe("hello")
    expect(docs.read(`${runDir}/output/t/files/a.txt`)?.text).toBe("A")
  })
})

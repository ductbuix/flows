import { describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/contracts"
import { cloneNodeRecord, defaultNode, newNodeId } from "./default-node"

describe("defaultNode", () => {
  it("builds a valid record for every registry kind", () => {
    const kinds = [
      "trigger",
      "prompt",
      "asset",
      "agent",
      "command",
      "llm",
      "judge",
      "approval",
      "output",
    ] as const
    for (const kind of kinds) {
      const id = newNodeId(kind)
      const node = defaultNode(kind, id)
      const wf = workflowSchema.safeParse({
        id: "t",
        goal: "g",
        nodes: [node],
        edges: [],
      })
      expect(wf.success, kind).toBe(true)
    }
  })

  it("clones a node under a new id", () => {
    const src = workflowSchema.parse({
      id: "t",
      goal: "g",
      nodes: [{ id: "a", kind: "agent", cli: "claude", model: "opus" }],
      edges: [],
    }).nodes[0]!
    expect(cloneNodeRecord(src, "b")).toMatchObject({
      id: "b",
      kind: "agent",
      cli: "claude",
      model: "opus",
    })
  })
})

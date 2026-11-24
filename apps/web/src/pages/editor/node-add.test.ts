import { describe, expect, it } from "vitest"
import { parseNodeWorkflowYaml } from "@workspace/shared"
import {
  freeNodeId,
  kindsForWire,
  wireRefusal,
  yamlAfterAddNode,
  yamlAfterSample,
} from "./node-add"

const base = "id: demo\nnodes: []\nedges: []\n"

describe("node-add", () => {
  it("builds a connected chain that parses", () => {
    let yaml = base
    const a = yamlAfterAddNode(yaml, "trigger")
    const b = yamlAfterAddNode(a.yaml, "command", {
      id: a.id,
      handle: "source",
    })
    const c = yamlAfterAddNode(b.yaml, "output", { id: b.id, handle: "source" })
    yaml = c.yaml
    const { workflow, errors } = parseNodeWorkflowYaml(yaml)
    expect(errors).toEqual([])
    expect(workflow?.nodes.map((n) => n.kind)).toEqual([
      "trigger",
      "command",
      "output",
    ])
    expect(workflow?.edges).toEqual([
      { from: "trigger", to: "command" },
      { from: "command", to: "output" },
    ])
  })

  it("wires a new node ahead of the one it was dragged from", () => {
    const a = yamlAfterAddNode(base, "output")
    const b = yamlAfterAddNode(a.yaml, "command", {
      id: a.id,
      handle: "target",
    })
    expect(parseNodeWorkflowYaml(b.yaml).workflow?.edges).toEqual([
      { from: "command", to: "output" },
    ])
  })

  it("picks a free id", () => {
    expect(freeNodeId("command", ["command", "command-2"])).toBe("command-3")
  })

  it("filters kinds by the open port", () => {
    expect(kindsForWire("source")).not.toContain("trigger")
    expect(kindsForWire("source")).toContain("output")
    expect(kindsForWire("target")).not.toContain("output")
    expect(kindsForWire("target")).toContain("trigger")
  })

  it("refuses bad wires with a reason", () => {
    const nodes = [
      { id: "t", kind: "trigger" },
      { id: "o", kind: "output" },
    ]
    expect(wireRefusal(nodes, [], { from: "o", to: "t" })).toMatch(
      /Output has no text output/
    )
    expect(wireRefusal(nodes, [], { from: "t", to: "t" })).toMatch(/itself/)
    expect(
      wireRefusal(nodes, [{ from: "t", to: "o" }], { from: "t", to: "o" })
    ).toMatch(/already connected/)
    expect(wireRefusal(nodes, [], { from: "t", to: "o" })).toBeNull()
  })

  it("adds the sample", () => {
    const { workflow } = parseNodeWorkflowYaml(yamlAfterSample(base))
    expect(workflow?.nodes).toHaveLength(3)
    expect(workflow?.edges).toHaveLength(2)
  })
})

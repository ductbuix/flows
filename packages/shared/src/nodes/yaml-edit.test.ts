import { describe, expect, it } from "vitest"
import { workflowSchema } from "./index.ts"
import {
  addEdge,
  addNode,
  removeEdge,
  removeNode,
  renameNode,
  setNodeKey,
} from "./yaml-edit.ts"
import { parse } from "yaml"

const fixture = `# my flow
id: wf
nodes:
  # the start
  - id: a
    kind: trigger
    type: manual
  - id: b # worker
    kind: agent
    cli: claude
    effort: low
edges:
  - { from: a, to: b } # main
`

const valid = (t: string) => workflowSchema.parse(parse(t))

describe("node yaml edit helpers", () => {
  it("adds a node and an edge, keeping comments", () => {
    let t = addNode(fixture, { id: "c", kind: "prompt" })
    t = addEdge(t, { from: "c", to: "b" })
    expect(t).toContain("# my flow")
    expect(t).toContain("# the start")
    expect(t).toContain("# worker")
    expect(t).toContain("# main")
    const wf = valid(t)
    expect(wf.nodes.map((n) => n.id)).toEqual(["a", "b", "c"])
    expect(wf.edges).toHaveLength(2)
  })

  it("does not add a duplicate edge", () => {
    expect(addEdge(fixture, { from: "a", to: "b" })).toBe(fixture)
  })

  it("removes a node with its edges", () => {
    const t = removeNode(fixture, "b")
    expect(t).toContain("# the start")
    const wf = valid(t)
    expect(wf.nodes.map((n) => n.id)).toEqual(["a"])
    expect(wf.edges).toEqual([])
  })

  it("renames a node and every edge end", () => {
    let t = addNode(fixture, { id: "c", kind: "output", target: "folder" })
    t = addEdge(t, { from: "b", to: "c" })
    t = renameNode(t, "b", "z")
    expect(t).toContain("# worker")
    const wf = valid(t)
    expect(wf.nodes.map((n) => n.id)).toEqual(["a", "z", "c"])
    expect(wf.edges).toEqual([
      { from: "a", to: "z" },
      { from: "z", to: "c" },
    ])
  })

  it("sets and deletes a node key in place", () => {
    const set = setNodeKey(fixture, "b", "effort", "high")
    expect(set).toContain("effort: high")
    expect(set.indexOf("cli: claude")).toBeLessThan(set.indexOf("effort"))
    const del = setNodeKey(fixture, "b", "effort", undefined)
    expect(del).not.toContain("effort")
    expect(del).toContain("# worker")
  })

  it("removes an edge", () => {
    const t = removeEdge(fixture, { from: "a", to: "b" })
    expect(valid(t).edges).toEqual([])
  })

  it("returns the input when the target is missing", () => {
    expect(removeNode(fixture, "nope")).toBe(fixture)
    expect(renameNode(fixture, "nope", "x")).toBe(fixture)
    expect(setNodeKey(fixture, "nope", "k", 1)).toBe(fixture)
    expect(removeEdge(fixture, { from: "x", to: "y" })).toBe(fixture)
  })
})

describe("empty flow lists", () => {
  it("grow into block lists", () => {
    const text = addNode("id: a\nnodes: []\nedges: []\n", {
      id: "t",
      kind: "trigger",
      type: "manual",
    })
    expect(text).toContain("nodes:\n  - ")
    const out = addEdge(text, { from: "t", to: "t" })
    expect(out).toContain("edges:\n  - { from: t, to: t }")
  })
})

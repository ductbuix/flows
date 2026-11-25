import { describe, expect, it } from "vitest"
import { workflowSchema, type LayoutFile } from "@workspace/contracts"
import {
  canvasToLayout,
  connectionToEdge,
  workflowEdgesToCanvas,
  workflowToCanvas,
} from "./flow-graph"

const yamlWorkflow = workflowSchema.parse({
  id: "demo",
  nodes: [
    { id: "start", kind: "trigger", type: "manual" },
    { id: "build", kind: "command", run: "echo hi" },
    { id: "done", kind: "output", target: "folder" },
  ],
  edges: [
    { from: "start", to: "build" },
    { from: "build", to: "done" },
  ],
})

describe("workflowToCanvas", () => {
  it("uses saved positions and maps edges", () => {
    const layout: LayoutFile = {
      version: 1,
      nodes: {
        start: { x: 10, y: 20 },
        build: { x: 400, y: 20 },
        done: { x: 800, y: 20 },
      },
    }
    const { nodes, edges } = workflowToCanvas(yamlWorkflow, layout)
    expect(nodes.map((n) => n.position)).toEqual([
      { x: 10, y: 20 },
      { x: 400, y: 20 },
      { x: 800, y: 20 },
    ])
    expect(nodes.map((n) => n.type)).toEqual([
      "flow-trigger",
      "flow-command",
      "flow-output",
    ])
    expect(edges).toHaveLength(2)
    expect(edges[0]).toMatchObject({
      source: "start",
      target: "build",
      sourceHandle: "text",
      targetHandle: "text",
    })
  })

  it("fills missing positions with dagre", () => {
    const { nodes } = workflowToCanvas(yamlWorkflow, {
      version: 1,
      nodes: { start: { x: 0, y: 0 } },
    })
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n.position]))
    expect(byId.start).toEqual({ x: 0, y: 0 })
    expect(byId.build).not.toEqual({ x: 0, y: 0 })
    expect(byId.done).toBeDefined()
  })
})

describe("workflowEdgesToCanvas / canvasToLayout", () => {
  it("labels judge branches and round-trips layout", () => {
    const edges = workflowEdgesToCanvas([
      { from: "j", to: "a", branch: "yes" },
      { from: "j", to: "b", branch: "no" },
    ])
    expect(edges[0]).toMatchObject({
      sourceHandle: "yes",
      label: "Yes",
    })
    expect(edges[1]).toMatchObject({
      sourceHandle: "no",
      label: "No",
    })
    expect(
      canvasToLayout([{ id: "a", position: { x: 1, y: 2 } }], {
        x: 0,
        y: 0,
        zoom: 1,
      })
    ).toEqual({
      version: 1,
      nodes: { a: { x: 1, y: 2 } },
      viewport: { x: 0, y: 0, zoom: 1 },
    })
  })
})

describe("connectionToEdge", () => {
  const kinds: Record<string, string> = {
    t: "trigger",
    l: "llm",
    c: "command",
    j: "judge",
    o: "output",
  }
  const kindOf = (id: string) => kinds[id]

  it("wires text to text and omits the default port", () => {
    expect(
      connectionToEdge(
        {
          source: "t",
          target: "l",
          sourceHandle: "text",
          targetHandle: "text",
        },
        kindOf
      )
    ).toEqual({ from: "t", to: "l" })
  })

  it("keeps file ports and judge branches", () => {
    expect(
      connectionToEdge(
        {
          source: "c",
          target: "o",
          sourceHandle: "file",
          targetHandle: "file",
        },
        kindOf
      )
    ).toEqual({ from: "c", to: "o", port: "file" })
    expect(
      connectionToEdge(
        { source: "j", target: "o", sourceHandle: "no", targetHandle: "text" },
        kindOf
      )
    ).toEqual({ from: "j", to: "o", branch: "no" })
  })

  it("rejects mismatched ports, self loops and trigger files", () => {
    expect(
      connectionToEdge(
        {
          source: "c",
          target: "l",
          sourceHandle: "text",
          targetHandle: "file",
        },
        kindOf
      )
    ).toBeNull()
    expect(
      connectionToEdge(
        {
          source: "l",
          target: "l",
          sourceHandle: "text",
          targetHandle: "text",
        },
        kindOf
      )
    ).toBeNull()
    expect(
      connectionToEdge(
        {
          source: "t",
          target: "c",
          sourceHandle: "file",
          targetHandle: "file",
        },
        kindOf
      )
    ).toBeNull()
  })
})

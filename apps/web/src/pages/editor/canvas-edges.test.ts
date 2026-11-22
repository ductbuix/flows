import { workflowSchema } from "@workspace/shared"
import { describe, expect, it } from "vitest"
import { canvasEdges } from "./canvas-edges"
import { placeNodes } from "./node-canvas-layout"

const workflow = workflowSchema.parse({
  id: "w",
  nodes: [
    { id: "t", kind: "trigger", type: "manual" },
    { id: "a", kind: "command", run: "echo" },
    { id: "j", kind: "judge", cli: "claude" },
    { id: "ok", kind: "command", run: "echo" },
  ],
  edges: [
    { from: "t", to: "a" },
    { from: "a", to: "j" },
    { from: "j", to: "a", branch: "no" },
    { from: "j", to: "ok", branch: "yes" },
  ],
})

describe("canvasEdges", () => {
  it("draws only the loop edge as a loop and keeps its branch", () => {
    const edges = canvasEdges(workflow)
    expect(edges.map((e) => e.type)).toEqual([undefined, undefined, "loop", undefined])
    expect(edges[2]!.data).toEqual({ branch: "no" })
    expect(edges[3]!.label).toBe("Yes")
  })

  it("places nodes left to right as if the loop edge were absent", () => {
    const pos = placeNodes(workflow.nodes, workflow.edges, {})
    expect(pos.t!.x).toBeLessThan(pos.a!.x)
    expect(pos.a!.x).toBeLessThan(pos.j!.x)
    expect(pos.j!.x).toBeLessThan(pos.ok!.x)
  })
})

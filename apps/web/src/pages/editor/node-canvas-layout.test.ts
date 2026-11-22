import { describe, expect, it } from "vitest"
import { NODE_H, NODE_W, placeNodes } from "./node-canvas-layout"

const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }]
const edges = [
  { from: "a", to: "b" },
  { from: "a", to: "c" },
]

describe("placeNodes", () => {
  it("lays out with dagre when nothing is saved", () => {
    const pos = placeNodes(nodes, edges, {})
    expect(pos.b!.x).toBeGreaterThan(pos.a!.x)
    expect(pos.b!.x).toBe(pos.c!.x)
    expect(pos.b!.y).not.toBe(pos.c!.y)
  })

  it("keeps saved positions", () => {
    const pos = placeNodes(nodes, edges, { a: { x: 500, y: 40 } })
    expect(pos.a).toEqual({ x: 500, y: 40 })
  })

  it("puts an unsaved node right of its saved input without overlap", () => {
    const pos = placeNodes(nodes, edges, { a: { x: 100, y: 100 } })
    expect(pos.b!.x).toBeGreaterThan(100 + NODE_W)
    expect(pos.c!.x).toBe(pos.b!.x)
    expect(Math.abs(pos.c!.y - pos.b!.y)).toBeGreaterThanOrEqual(NODE_H)
  })

  it("places a chain of unsaved nodes after a saved one", () => {
    const pos = placeNodes(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
      { a: { x: 0, y: 0 } }
    )
    expect(pos.c!.x).toBeGreaterThan(pos.b!.x)
  })
})

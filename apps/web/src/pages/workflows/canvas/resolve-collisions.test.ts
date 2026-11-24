import { describe, expect, it } from "vitest"
import type { Node } from "@xyflow/react"
import { resolveCollisions } from "./resolve-collisions"

const node = (id: string, x: number, y: number): Node => ({
  id,
  position: { x, y },
  data: {},
  width: 100,
  height: 50,
})

const overlaps = (a: Node, b: Node, m: number) =>
  Math.min(a.position.x + 100, b.position.x + 100) -
    Math.max(a.position.x, b.position.x) +
    m >
    0 &&
  Math.min(a.position.y + 50, b.position.y + 50) -
    Math.max(a.position.y, b.position.y) +
    m >
    0

describe("resolveCollisions", () => {
  it("returns the same array when nothing collides", () => {
    const ns = [node("a", 0, 0), node("b", 300, 0)]
    expect(resolveCollisions(ns, { margin: 10 })).toBe(ns)
  })

  it("keeps pinned nodes and pushes the other away", () => {
    const ns = [node("a", 0, 0), node("b", 50, 10)]
    const out = resolveCollisions(ns, { pinned: new Set(["a"]), margin: 10 })
    expect(out[0]).toBe(ns[0])
    expect(overlaps(out[0]!, out[1]!, 10)).toBe(false)
  })

  it("cascades through a chain of nodes", () => {
    const ns = [
      node("a", 0, 0),
      node("b", 60, 0),
      node("c", 130, 0),
      node("d", 200, 0),
    ]
    const out = resolveCollisions(ns, { pinned: new Set(["a"]), margin: 10 })
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++)
        expect(overlaps(out[i]!, out[j]!, 10)).toBe(false)
    expect(out[0]!.position).toEqual({ x: 0, y: 0 })
  })

  it("splits movement between two free nodes", () => {
    const out = resolveCollisions([node("a", 0, 0), node("b", 80, 0)], {
      margin: 0,
    })
    expect(overlaps(out[0]!, out[1]!, 0)).toBe(false)
    expect(out[0]!.position.x).toBeLessThan(0)
    expect(out[1]!.position.x).toBeGreaterThan(80)
  })
})

import type { Node } from "@xyflow/react"

export type CollisionOptions = {
  /** Node ids that must not move (e.g. the nodes just dropped). */
  pinned?: ReadonlySet<string>
  /** Gap kept between nodes, in flow units. */
  margin?: number
  /** Safety cap on full passes; packed layouts converge long before it. */
  maxIterations?: number
}

const FALLBACK_W = 260
const FALLBACK_H = 120

type Box = { x: number; y: number; w: number; h: number; movable: boolean }

function sizeOf(n: Node): { w: number; h: number } {
  return {
    w: n.measured?.width ?? n.width ?? FALLBACK_W,
    h: n.measured?.height ?? n.height ?? FALLBACK_H,
  }
}

/**
 * Push overlapping nodes apart. Naive pairwise resolution along the axis of
 * least overlap, repeated until stable (the algorithm xyflow recommends below
 * ~500 nodes; workflows are far smaller). Pinned nodes never move, so the
 * node being dragged wins and its neighbours cascade away. Returns the same
 * array when nothing overlaps, and reuses untouched node objects.
 */
export function resolveCollisions<T extends Node>(
  nodes: T[],
  { pinned, margin = 24, maxIterations = 200 }: CollisionOptions = {}
): T[] {
  const boxes: Box[] = nodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    ...sizeOf(n),
    movable: !pinned?.has(n.id) && n.draggable !== false,
  }))
  const moved = new Set<number>()

  for (let iter = 0; iter < maxIterations; iter++) {
    let found = false
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]!
        if (!a.movable && !b.movable) continue
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + margin
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + margin
        if (ox <= 0 || oy <= 0) continue
        found = true
        const alongX = ox < oy
        const overlap = alongX ? ox : oy
        const dir =
          (alongX
            ? a.x + a.w / 2 - (b.x + b.w / 2)
            : a.y + a.h / 2 - (b.y + b.h / 2)) < 0
            ? -1
            : 1
        // dir > 0: a is right/below b, so a moves +, b moves -.
        const shareA = a.movable ? (b.movable ? 0.5 : 1) : 0
        const shareB = b.movable ? (a.movable ? 0.5 : 1) : 0
        if (alongX) {
          a.x += dir * overlap * shareA
          b.x -= dir * overlap * shareB
        } else {
          a.y += dir * overlap * shareA
          b.y -= dir * overlap * shareB
        }
        if (shareA) moved.add(i)
        if (shareB) moved.add(j)
      }
    }
    if (!found) break
  }

  if (moved.size === 0) return nodes
  return nodes.map((n, i) =>
    moved.has(i) ? { ...n, position: { x: boxes[i]!.x, y: boxes[i]!.y } } : n
  )
}

import { describe, expect, it } from "vitest"
import { compareRank } from "./rank.ts"
import { computeMoveRank, rankAtColumnEnd, type MoveRankFace } from "./move.ts"

function face(id: string, status: string, rank: string): MoveRankFace {
  return { id, status, rank }
}

describe("compareRank", () => {
  it("orders by code unit, not locale collation", () => {
    expect(compareRank(face("a", "todo", "a"), face("B", "todo", "B"))).toBe(1)
    const sorted = [
      face("lower", "todo", "B"),
      face("upper", "todo", "a"),
    ].sort(compareRank)
    expect(sorted.map((f) => f.id)).toEqual(["lower", "upper"])
  })
})

describe("computeMoveRank", () => {
  const todo = "todo"

  it("does not throw when uppercase ranks precede lowercase in the column", () => {
    const faces = [
      face("cap", todo, "B"),
      face("low", todo, "a"),
      face("move", todo, "m"),
    ]
    const rank = computeMoveRank(faces, "move", todo, "low")
    expect(rank > "B" && rank < "a").toBe(true)
  })

  it("places a card at the top of a column", () => {
    const faces = [
      face("first", todo, "m"),
      face("second", todo, "z"),
      face("move", todo, "zz"),
    ]
    const rank = computeMoveRank(faces, "move", todo, "first")
    expect(rank < "m").toBe(true)
    const ordered = [
      ...faces.filter((f) => f.id !== "move"),
      { id: "move", status: todo, rank },
    ].sort(compareRank)
    expect(ordered[0]!.id).toBe("move")
  })

  it("handles a column where every card lacks a rank", () => {
    const faces = [
      face("alpha", todo, ""),
      face("beta", todo, ""),
      face("b", todo, ""),
    ]
    expect(() => computeMoveRank(faces, "b", todo, "beta")).not.toThrow()
    const rank = computeMoveRank(faces, "b", todo, "beta")
    const ordered = [
      face("alpha", todo, ""),
      { ...face("b", todo, rank), id: "b" },
      face("beta", todo, ""),
    ].sort(compareRank)
    expect(ordered.map((f) => f.id)).toEqual(["alpha", "b", "beta"])
  })

  it("inserts between two cards that share the same rank", () => {
    const faces = [
      face("a", todo, "m"),
      face("z", todo, "m"),
      face("m", todo, "m"),
    ]
    expect(() => computeMoveRank(faces, "m", todo, "z")).not.toThrow()
    const rank = computeMoveRank(faces, "m", todo, "z")
    const ordered = [
      face("a", todo, "m"),
      { ...face("m", todo, rank), id: "m" },
      face("z", todo, "m"),
    ].sort(compareRank)
    expect(ordered.map((f) => f.id)).toEqual(["a", "m", "z"])
  })
})

describe("rankAtColumnEnd", () => {
  it("returns distinct ranks after the last card in the column", () => {
    const faces = [face("a", "todo", "a"), face("b", "todo", "m")]
    const first = rankAtColumnEnd(faces, "todo")
    const second = rankAtColumnEnd([...faces, face("c", "todo", first)], "todo")
    expect(first > "m").toBe(true)
    expect(second > first).toBe(true)
  })
})

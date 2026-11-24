import { describe, expect, it } from "vitest"
import { mergeTodos, parseUpdateTodosParams } from "./update-todos.ts"

describe("mergeTodos", () => {
  const a = { id: "1", content: "A", status: "pending" }
  const b = { id: "2", content: "B", status: "in_progress" }
  const aDone = { id: "1", content: "A", status: "completed" }
  const c = { id: "3", content: "C", status: "pending" }

  it("replace when merge is false", () => {
    expect(mergeTodos([a, b], [c], false)).toEqual([c])
  })

  it("merges by id when merge is true", () => {
    expect(mergeTodos([a, b], [aDone, c], true)).toEqual([aDone, b, c])
  })
})

describe("parseUpdateTodosParams", () => {
  it("reads toolCallId, todos and merge", () => {
    expect(
      parseUpdateTodosParams({
        toolCallId: "call_1",
        todos: [{ id: "1", content: "x", status: "pending" }],
        merge: true,
      })
    ).toEqual({
      toolCallId: "call_1",
      todos: [{ id: "1", content: "x", status: "pending" }],
      merge: true,
    })
  })

  it("returns null when malformed", () => {
    expect(parseUpdateTodosParams({})).toBeNull()
  })
})

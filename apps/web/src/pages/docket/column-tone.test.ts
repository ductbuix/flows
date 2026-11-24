import { describe, expect, it } from "vitest"
import { toUiColumns } from "./column-tone"

describe("toUiColumns", () => {
  it("maps done and tone passthrough", () => {
    expect(
      toUiColumns([
        { id: "todo", label: "Todo", tone: "idle" },
        { id: "done", label: "Done", done: true },
        { id: "x", label: "X" },
      ])
    ).toEqual([
      { id: "todo", label: "Todo", done: undefined, tone: "idle" },
      { id: "done", label: "Done", done: true, tone: "done" },
      { id: "x", label: "X", done: undefined, tone: "idle" },
    ])
  })
})

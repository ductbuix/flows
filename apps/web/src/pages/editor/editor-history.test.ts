import { describe, expect, it } from "vitest"
import {
  EDITOR_HISTORY_CAP,
  emptyEditorHistory,
  pushEditorSnapshot,
  redoEditor,
  undoEditor,
} from "./editor-history"

describe("editor-history", () => {
  it("pushes and undoes then redoes", () => {
    let h = emptyEditorHistory
    h = pushEditorSnapshot(h, { yaml: "a", selectedTaskId: "t1" })
    h = pushEditorSnapshot(h, { yaml: "b" })
    expect(h.past).toHaveLength(2)

    const u = undoEditor(h, { yaml: "c", selectedTaskId: "t2" })
    expect(u?.snap).toEqual({ yaml: "b" })
    expect(u?.history.past).toHaveLength(1)
    expect(u?.history.future).toEqual([{ yaml: "c", selectedTaskId: "t2" }])

    const r = redoEditor(u!.history, u!.snap)
    expect(r?.snap).toEqual({ yaml: "c", selectedTaskId: "t2" })
    expect(r?.history.future).toEqual([])
  })

  it("caps at EDITOR_HISTORY_CAP", () => {
    let h = emptyEditorHistory
    for (let i = 0; i < EDITOR_HISTORY_CAP + 5; i++) {
      h = pushEditorSnapshot(h, { yaml: String(i) })
    }
    expect(h.past).toHaveLength(EDITOR_HISTORY_CAP)
    expect(h.past[0]?.yaml).toBe("5")
  })

  it("returns null when empty", () => {
    expect(undoEditor(emptyEditorHistory, { yaml: "x" })).toBeNull()
    expect(redoEditor(emptyEditorHistory, { yaml: "x" })).toBeNull()
  })
})

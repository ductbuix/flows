import { describe, expect, it } from "vitest"
import { pickFromFiles } from "./DiskPicker"

describe("DiskPicker pickFromFiles", () => {
  it("builds a single-file pick", () => {
    const file = new File(["hello"], "note.md", { type: "text/markdown" })
    const pick = pickFromFiles([file], false)
    expect(pick).toMatchObject({
      label: "note.md",
      folder: false,
    })
    expect(pick?.entries).toHaveLength(1)
    expect(pick?.entries[0]?.path).toBe("note.md")
    expect(pick?.entries[0]?.file).toBe(file)
  })

  it("uses the folder name as the label", () => {
    const file = new File(["x"], "a.txt")
    Object.defineProperty(file, "webkitRelativePath", {
      value: "docs/a.txt",
    })
    const pick = pickFromFiles([file], true)
    expect(pick).toMatchObject({ label: "docs", folder: true })
    expect(pick?.entries[0]?.path).toBe("docs/a.txt")
  })
})

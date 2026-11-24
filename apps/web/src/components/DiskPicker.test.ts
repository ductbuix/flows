import { describe, expect, it } from "vitest"
import { assetKindOf, pickFrom } from "./DiskPicker"

describe("DiskPicker pickFrom", () => {
  it("builds a single-file pick", () => {
    const file = new File(["hello"], "note.md", { type: "text/markdown" })
    const pick = pickFrom([file], false)
    expect(pick).toMatchObject({
      label: "note.md",
      folder: false,
      kind: "other",
    })
    expect(pick?.assets[0]).toMatchObject({ name: "note.md", kind: "md" })
    expect(pick?.files).toHaveLength(1)
  })

  it("classifies image kinds", () => {
    expect(assetKindOf("shot.PNG")).toBe("image")
    expect(assetKindOf("page.html")).toBe("html")
  })
})

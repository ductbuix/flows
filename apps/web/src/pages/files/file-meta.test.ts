import { describe, expect, it } from "vitest"
import { fileKindLabel, formatFileSize, formatStatLine } from "./file-meta"

describe("file-meta", () => {
  it("labels common extensions and folders", () => {
    expect(fileKindLabel("docket/board.yaml", "file")).toBe("YAML")
    expect(fileKindLabel("notes.md", "file")).toBe("Markdown")
    expect(fileKindLabel("data.bin", "file")).toBe("File")
    expect(fileKindLabel("docket", "dir")).toBe("Folder")
  })

  it("formats sizes like the mock", () => {
    expect(formatFileSize(42)).toBe("42 B")
    expect(formatFileSize(2400)).toBe("2.4 KB")
    expect(formatFileSize(2_400_000)).toBe("2.4 MB")
  })

  it("builds the preview meta line", () => {
    expect(formatStatLine("a.yaml", { kind: "file", size: 120 })).toBe(
      "YAML · 120 B"
    )
    expect(formatStatLine("docket", { kind: "dir" })).toBe("Folder")
  })
})

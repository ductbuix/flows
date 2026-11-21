import { describe, expect, it } from "vitest"
import { pathsToFileTree } from "./file-tree"

describe("pathsToFileTree", () => {
  it("nests folders and sorts folders before files", () => {
    const tree = pathsToFileTree([
      "z.txt",
      "sub/b.txt",
      "sub/a.txt",
      "deep/x/y.txt",
    ])
    expect(tree.map((n) => n.name)).toEqual(["deep", "sub", "z.txt"])
    const sub = tree.find((n) => n.name === "sub")
    expect(sub?.type).toBe("folder")
    if (sub?.type === "folder") {
      expect(sub.children.map((c) => c.name)).toEqual(["a.txt", "b.txt"])
    }
  })
})

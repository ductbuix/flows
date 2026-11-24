import { describe, expect, it } from "vitest"
import { confineToRoots, normalizeStorePath } from "./paths.ts"

describe("normalizeStorePath", () => {
  it("strips leading slash and resolves . segments", () => {
    expect(normalizeStorePath("/docket/./board.yaml")).toBe("docket/board.yaml")
    expect(normalizeStorePath("workflows/a/../b")).toBe("workflows/b")
  })

  it("returns null when .. escapes the store root", () => {
    expect(normalizeStorePath("../outside")).toBeNull()
    expect(normalizeStorePath("a/../../outside")).toBeNull()
    expect(normalizeStorePath("/../etc/passwd")).toBeNull()
  })
})

describe("confineToRoots", () => {
  it("allows the whole store when root is empty", () => {
    expect(confineToRoots("docket/board.yaml", [""])).toBe("docket/board.yaml")
    expect(confineToRoots("", [""])).toBe("")
  })

  it("rejects paths outside a narrower root", () => {
    expect(confineToRoots("secrets/x", ["workflows"])).toBeNull()
    expect(confineToRoots("workflows/a.md", ["workflows"])).toBe(
      "workflows/a.md"
    )
  })

  it("rejects .. escapes even when the final name looks allowed", () => {
    expect(
      confineToRoots("workflows/../../secrets/x", ["workflows"])
    ).toBeNull()
    expect(confineToRoots("../workflows/a.md", ["workflows"])).toBeNull()
  })
})

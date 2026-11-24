import type { LibItem } from "@workspace/contracts"
import { describe, expect, it } from "vitest"
import {
  countBySource,
  filterItems,
  sourceTabs,
  splitTag,
} from "./library-filter"

const items = [
  {
    id: "github-acme",
    kind: "repo",
    title: "acme",
    source: "github",
    remoteId: "acme/demo",
    tags: ["repo:acme"],
    current: 1,
    versions: [],
  },
  {
    id: "local-notes",
    kind: "other",
    title: "Notes",
    source: "local",
    tags: ["type:notes"],
    current: 1,
    versions: [],
  },
] as unknown as LibItem[]

describe("library-filter", () => {
  it("filters by kind and search", () => {
    expect(filterItems(items, "all", "").map((i) => i.id)).toEqual([
      "github-acme",
      "local-notes",
    ])
    expect(filterItems(items, "github", "").map((i) => i.id)).toEqual([
      "github-acme",
    ])
    expect(filterItems(items, "all", "notes").map((i) => i.id)).toEqual([
      "local-notes",
    ])
    expect(filterItems(items, "all", "acme/demo").map((i) => i.id)).toEqual([
      "github-acme",
    ])
  })

  it("counts and builds source tabs", () => {
    expect(countBySource(items, "all")).toBe(2)
    expect(countBySource(items, "local")).toBe(1)
    expect(
      sourceTabs(items, [{ id: "github", label: "GitHub" } as never])
    ).toEqual([
      { id: "github", label: "GitHub" },
      { id: "local", label: "Local files" },
    ])
  })

  it("splits tags", () => {
    expect(splitTag("repo:acme")).toEqual(["repo", "acme"])
    expect(splitTag("plain")).toEqual(["", "plain"])
  })
})

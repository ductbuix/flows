import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { parseFrontmatter, run, tableErrors } from "./docs.ts"

const design = (over: Record<string, string> = {}) => {
  const fm = {
    id: "DES-001",
    title: "Overview",
    type: "design",
    status: "active",
    summary: '"Engine: event log, scheduler"',
    tags: "[engine]",
    related: "[]",
    updated: "2026-11-20",
    ...over,
  }
  const yaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
  return `---\n${yaml}\n---\n\n# Overview\n`
}

let docs: string
const write = (rel: string, text: string) =>
  writeFileSync(join(docs, rel), text)

beforeEach(() => {
  docs = join(mkdtempSync(join(tmpdir(), "docs-test-")), "docs")
  mkdirSync(join(docs, "designs"), { recursive: true })
  mkdirSync(join(docs, "backlogs"), { recursive: true })
  write("designs/des-001-overview.md", design())
  write(
    "README.md",
    design({ id: "DOC-001", type: "guide", title: "Docs system" })
  )
})

describe("parseFrontmatter", () => {
  it("accepts a valid doc and keeps colons in values", () => {
    const r = parseFrontmatter(design())
    expect(r.ok && r.meta.summary).toBe("Engine: event log, scheduler")
  })

  it("reports precise schema errors", () => {
    const r = parseFrontmatter(
      design({ id: "X-1", updated: "today", extra: "1" })
    )
    expect(r.ok).toBe(false)
    const errors = r.ok ? [] : r.errors.join("\n")
    expect(errors).toMatch(/id: must look like DES-001/)
    expect(errors).toMatch(/updated: must be YYYY-MM-DD/)
    expect(errors).toMatch(/extra/)
  })

  it("requires backlog fields", () => {
    const r = parseFrontmatter(design({ id: "BL-001", type: "backlog" }))
    expect(r.ok ? [] : r.errors.join("\n")).toMatch(/priority/)
  })
})

describe("run", () => {
  it("writes indexes, then check passes", () => {
    expect(run(docs, "index").errors).toEqual([])
    expect(run(docs, "check").errors).toEqual([])
    expect(readFileSync(join(docs, "designs/INDEX.md"), "utf8")).toContain(
      "| DES-001 | design | active | [Overview](des-001-overview.md) |"
    )
  })

  it("lists direction docs at the top of the root index", () => {
    write(
      "designs/des-002-vision.md",
      design({ id: "DES-002", type: "direction", title: "Vision" })
    )
    expect(run(docs, "index").errors).toEqual([])
    const root = readFileSync(join(docs, "INDEX.md"), "utf8")
    expect(root).toContain("| DES-002 | [Vision](designs/des-002-vision.md) |")
    expect(root).not.toContain("| DES-001 | [Overview]")
    expect(root.indexOf("| ID | Direction |")).toBeLessThan(
      root.indexOf("| Section |")
    )
  })

  it("rejects direction docs outside designs", () => {
    write("backlogs/bl-001-x.md", design({ id: "BL-001", type: "direction" }))
    expect(run(docs, "index").errors.join("\n")).toMatch(/type must be one of/)
  })

  it("fails on a stale index", () => {
    run(docs, "index")
    write("designs/des-001-overview.md", design({ title: "Renamed" }))
    expect(run(docs, "check").errors.join("\n")).toMatch(
      /designs\/INDEX.md: stale/
    )
  })

  it("fails on broken refs and links", () => {
    write(
      "designs/des-002-bad.md",
      design({ id: "DES-002", related: "[DES-404]" }) + "[x](nope.md)\n"
    )
    const errors = run(docs, "index").errors.join("\n")
    expect(errors).toMatch(/related DES-404 not found/)
    expect(errors).toMatch(/broken link: nope.md/)
  })

  it("fails on files over 300 lines", () => {
    write("designs/des-001-overview.md", design() + "x\n".repeat(300))
    expect(run(docs, "index").errors.join("\n")).toMatch(/lines, max 300/)
  })

  it("fails on duplicate ids and wrong file names", () => {
    write("designs/des-009-copy.md", design())
    const errors = run(docs, "index").errors.join("\n")
    expect(errors).toMatch(/duplicate id DES-001/)
    expect(errors).toMatch(/file name must start with des-001-/)
  })
})

describe("tableErrors", () => {
  it("accepts a compact GFM table", () => {
    expect(tableErrors("| a | b |\n| --- | --- |\n| 1 | x \\| y |\n")).toEqual(
      []
    )
  })

  it("ignores pipes inside fenced code blocks", () => {
    expect(tableErrors("```\n| box | box |\n|  x  |\n```\n")).toEqual([])
  })

  it("rejects a missing separator and ragged rows", () => {
    expect(tableErrors("| a | b |\n| 1 | 2 |\n")).toHaveLength(1)
    expect(tableErrors("| a | b |\n| --- | --- |\n| 1 |\n")).toHaveLength(1)
  })
})

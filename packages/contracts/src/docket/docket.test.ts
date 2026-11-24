import { describe, expect, it } from "vitest"
import { tolerantParseBoard, tolerantParseCard } from "./parse.ts"
import { boardSchema, cardSchema, refSchema } from "./schemas.ts"

const minimalCard = {
  id: "fix-flaky-login",
  title: "Fix flaky login test",
  status: "doing",
  created: "2026-11-20T09:12:00Z",
  updated: "2026-11-23T08:00:00Z",
}

describe("cardSchema", () => {
  it("accepts a minimal card", () => {
    const card = cardSchema.parse(minimalCard)
    expect(card.id).toBe(minimalCard.id)
    expect(card.title).toBe(minimalCard.title)
    expect(card.status).toBe(minimalCard.status)
  })

  it("keeps unknown top-level keys", () => {
    const card = cardSchema.parse({ ...minimalCard, xCustom: "kept" })
    expect(card.xCustom).toBe("kept")
  })
})

describe("refSchema", () => {
  it("keeps unknown keys on a ref", () => {
    const ref = refSchema.parse({
      system: "rally",
      xRally: { iteration: "Sprint 42" },
    })
    expect(ref.xRally).toEqual({ iteration: "Sprint 42" })
  })
})

describe("tolerantParseCard", () => {
  it("parses a minimal card without warnings", () => {
    const result = tolerantParseCard(minimalCard)
    expect(result.data).toEqual(minimalCard)
    expect(result.warnings).toEqual([])
  })

  it("keeps unknown keys and warns on invalid ISO dates", () => {
    const result = tolerantParseCard({
      ...minimalCard,
      created: "not-a-date",
      extra: true,
    })
    expect(result.data?.extra).toBe(true)
    expect(result.data?.created).toBe("not-a-date")
    expect(result.warnings.some((w) => w.includes("created"))).toBe(true)
  })

  it("drops a bad ref and keeps a good one", () => {
    const result = tolerantParseCard({
      ...minimalCard,
      refs: [{ system: "rally", kind: "story", id: "US1" }, { kind: "story" }],
    })
    expect(result.data).not.toBeNull()
    expect(result.data?.refs).toHaveLength(1)
    expect(result.data?.refs?.[0]?.id).toBe("US1")
    expect(result.warnings.some((w) => w.startsWith("refs[1]"))).toBe(true)
  })

  it("returns null when a required key is missing", () => {
    const rest = { ...minimalCard }
    delete (rest as { id?: string }).id
    const result = tolerantParseCard(rest)
    expect(result.data).toBeNull()
    expect(result.warnings.some((w) => w.includes("id"))).toBe(true)
  })

  it("omits non-object fields with a warning", () => {
    const result = tolerantParseCard({
      ...minimalCard,
      fields: "nope",
    })
    expect(result.data?.fields).toBeUndefined()
    expect(result.warnings).toContain("fields: expected object")
  })
})

describe("boardSchema", () => {
  it("defaults face to none and allows at most two face keys", () => {
    const bare = boardSchema.parse({
      version: 1,
      columns: [{ id: "todo", label: "Todo" }],
    })
    expect(bare.face).toEqual([])

    expect(
      boardSchema.safeParse({
        version: 1,
        columns: [{ id: "todo", label: "Todo" }],
        face: ["due", "fields.assignee"],
      }).success
    ).toBe(true)
    expect(
      boardSchema.safeParse({
        version: 1,
        columns: [{ id: "todo", label: "Todo" }],
        face: ["due", "fields.assignee", "rank"],
      }).success
    ).toBe(false)
  })
})

describe("tolerantParseBoard", () => {
  it("drops a bad column and keeps valid ones", () => {
    const result = tolerantParseBoard({
      version: 1,
      columns: [{ id: "todo", label: "Todo" }, { label: "No id" }],
    })
    expect(result.data?.columns).toHaveLength(1)
    expect(result.data?.columns[0]?.id).toBe("todo")
    expect(result.warnings.some((w) => w.startsWith("columns[1]"))).toBe(true)
  })
})

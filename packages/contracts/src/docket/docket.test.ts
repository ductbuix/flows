import { describe, expect, it } from "vitest"
import { tolerantParseCard } from "./parse.ts"
import { boardSchema, cardSchema } from "./schemas.ts"

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
})

describe("boardSchema", () => {
  it("allows at most two face keys", () => {
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

import { describe, expect, expectTypeOf, it } from "vitest"
import {
  CardId,
  ConnectorId,
  LibItemId,
  RunId,
  SkillSlug,
  StepId,
  WorkflowId,
} from "./ids.ts"

const valid = "my-item"
const invalid = ["", "Bad", "has_underscore", "-lead", "trail-", "a--b"]

describe("branded ids", () => {
  it.each([
    ["CardId", CardId],
    ["RunId", RunId],
    ["WorkflowId", WorkflowId],
    ["StepId", StepId],
    ["ConnectorId", ConnectorId],
    ["SkillSlug", SkillSlug],
    ["LibItemId", LibItemId],
  ] as const)("%s accepts slugs and rejects invalid", (_name, schema) => {
    expect(schema.parse(valid)).toBe(valid)
    expect(schema.parse("a")).toBe("a")
    expect(schema.parse("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    )
    for (const bad of invalid) {
      expect(schema.safeParse(bad).success).toBe(false)
    }
  })

  it("rejects a RunId where a CardId is expected", () => {
    const runId = RunId.parse("a-run")
    expectTypeOf(runId).toEqualTypeOf<RunId>()
    expectTypeOf(runId).not.toMatchTypeOf<CardId>()

    const needCard = (id: CardId): CardId => id
    // @ts-expect-error RunId is not assignable to CardId
    needCard(runId)
  })
})

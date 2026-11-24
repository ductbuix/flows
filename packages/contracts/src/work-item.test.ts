import { describe, expect, it } from "vitest"
import { attachmentNameSchema, workItemSchema } from "./work-item.ts"

const base = {
  id: "my-item",
  title: "My item",
  source: { kind: "adhoc" as const },
  createdAt: "2026-11-22T00:00:00.000Z",
  updatedAt: "2026-11-22T00:00:00.000Z",
}

describe("workItemSchema", () => {
  it("accepts an ad hoc item and fills defaults", () => {
    const item = workItemSchema.parse(base)
    expect(item.inputs).toEqual({})
    expect(item.links).toEqual([])
    expect(item.workflowId).toBeUndefined()
  })

  it("rejects unknown keys", () => {
    expect(workItemSchema.safeParse({ ...base, extra: true }).success).toBe(
      false
    )
  })

  it("accepts a Rally story source", () => {
    const item = workItemSchema.parse({
      ...base,
      source: {
        kind: "rally",
        connection: "rally-payments",
        entityKind: "story",
        entityId: "US123",
      },
    })
    expect(item.source).toEqual({
      kind: "rally",
      connection: "rally-payments",
      entityKind: "story",
      entityId: "US123",
    })
  })

  it("rejects an incomplete Rally source", () => {
    expect(
      workItemSchema.safeParse({
        ...base,
        source: { kind: "rally" },
      }).success
    ).toBe(false)
  })

  it("accepts a library source and links", () => {
    const item = workItemSchema.parse({
      ...base,
      source: {
        kind: "library",
        connection: "rally-pay",
        entityKind: "item",
        entityId: "PAY-1",
      },
      links: [
        {
          connection: "rally-pay",
          kind: "item",
          entityId: "PAY-1",
        },
      ],
    })
    expect(item.source).toEqual({
      kind: "library",
      connection: "rally-pay",
      entityKind: "item",
      entityId: "PAY-1",
    })
    expect(item.links).toHaveLength(1)
  })

  it("rejects a link missing entityId", () => {
    expect(
      workItemSchema.safeParse({
        ...base,
        links: [{ connection: "x", kind: "item" }],
      }).success
    ).toBe(false)
  })
})

describe("attachmentNameSchema", () => {
  it("accepts a basename and rejects path traversal", () => {
    expect(attachmentNameSchema.safeParse("notes.pdf").success).toBe(true)
    expect(attachmentNameSchema.safeParse("../x").success).toBe(false)
    expect(attachmentNameSchema.safeParse("a/b").success).toBe(false)
    expect(attachmentNameSchema.safeParse("a\\b").success).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import {
  applyInputDefaults,
  buildManualValuesSchema,
  canonicalManualItemPayload,
  canonicalWorkItemKeyPayload,
  normalizeInputText,
} from "./run-inputs.ts"
import type { WorkflowInputDecl } from "./workflow.ts"

describe("canonicalManualItemPayload", () => {
  it("is stable for the same sorted fields", () => {
    const a = canonicalManualItemPayload([
      { name: "ticket", type: "text", text: "ABC-1" },
      { name: "brief", type: "markdown", text: "# hi" },
    ])
    const b = canonicalManualItemPayload([
      { name: "brief", type: "markdown", text: "# hi" },
      { name: "ticket", type: "text", text: "ABC-1" },
    ])
    expect(a).toBe(b)
    expect(JSON.parse(a)).toMatchObject({ v: 1, source: "manual" })
  })
})

describe("canonicalWorkItemKeyPayload", () => {
  it("is stable for a work item id", () => {
    const payload = canonicalWorkItemKeyPayload("story-one")
    expect(JSON.parse(payload)).toEqual({
      v: 1,
      source: "workItem",
      workItemId: "story-one",
    })
  })
})

describe("normalizeInputText", () => {
  it("trims text but not markdown", () => {
    expect(normalizeInputText("text", "  x  ")).toBe("x")
    expect(normalizeInputText("markdown", "  x  ")).toBe("  x  ")
  })
})

describe("buildManualValuesSchema", () => {
  const decls: WorkflowInputDecl[] = [
    { name: "ticket", type: "text", required: true },
    { name: "brief", type: "markdown", required: false, default: "n/a" },
    { name: "attachment", type: "file", required: false },
  ]

  it("requires non-empty text fields and ignores file decls", () => {
    const schema = buildManualValuesSchema(decls)
    expect(schema.safeParse({ ticket: "T-1" }).success).toBe(true)
    expect(schema.safeParse({ ticket: "  " }).success).toBe(false)
    expect(schema.safeParse({}).success).toBe(false)
  })
})

describe("applyInputDefaults", () => {
  it("fills missing optional defaults", () => {
    const decls: WorkflowInputDecl[] = [
      { name: "brief", type: "markdown", required: false, default: "n/a" },
    ]
    expect(applyInputDefaults(decls, {})).toEqual({ brief: "n/a" })
  })
})

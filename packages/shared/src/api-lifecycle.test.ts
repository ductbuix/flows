import { describe, expect, it } from "vitest"
import { isAllowedWorkflowFilePath } from "./api-lifecycle.ts"

describe("isAllowedWorkflowFilePath", () => {
  it("accepts workflow-relative text paths", () => {
    expect(isAllowedWorkflowFilePath("nodes/plan/prompt.md")).toBe(true)
    expect(isAllowedWorkflowFilePath("memory/style.md")).toBe(true)
    expect(isAllowedWorkflowFilePath("notes.txt")).toBe(true)
  })

  it("rejects absolute, traversal and protected paths", () => {
    expect(isAllowedWorkflowFilePath("/abs.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("a\\b.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("../x.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("nodes/../x.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("nodes//x.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("workflow.yaml")).toBe(false)
    expect(isAllowedWorkflowFilePath("runs/r1/out.txt")).toBe(false)
    expect(isAllowedWorkflowFilePath(".cache/npm/x")).toBe(false)
    expect(isAllowedWorkflowFilePath("nodes/.trash/x/prompt.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("nodes/.trash")).toBe(false)
    expect(isAllowedWorkflowFilePath("")).toBe(false)
  })
})

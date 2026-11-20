import { describe, expect, it } from "vitest"
import { isAllowedWorkflowFilePath } from "./api-lifecycle.ts"

describe("isAllowedWorkflowFilePath", () => {
  it("accepts workflow-relative text paths", () => {
    expect(isAllowedWorkflowFilePath("tasks/plan.md")).toBe(true)
    expect(isAllowedWorkflowFilePath("memory/style.md")).toBe(true)
    expect(isAllowedWorkflowFilePath("notes.txt")).toBe(true)
  })

  it("rejects absolute, traversal and protected paths", () => {
    expect(isAllowedWorkflowFilePath("/abs.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("a\\b.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("../x.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("tasks/../x.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("tasks//x.md")).toBe(false)
    expect(isAllowedWorkflowFilePath("workflow.yaml")).toBe(false)
    expect(isAllowedWorkflowFilePath("runs/r1/out.txt")).toBe(false)
    expect(isAllowedWorkflowFilePath("")).toBe(false)
  })
})

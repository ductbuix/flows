import { describe, expect, it } from "vitest"
import { isWatchedWorkflowPath } from "./workflow-watch.ts"

describe("isWatchedWorkflowPath", () => {
  it("watches only workflow.yaml and memory/", () => {
    expect(isWatchedWorkflowPath("workflow.yaml")).toBe(true)
    expect(isWatchedWorkflowPath("memory/style.md")).toBe(true)
    expect(isWatchedWorkflowPath("runs/r1/graph.json")).toBe(false)
    expect(isWatchedWorkflowPath(".cache/npm/x")).toBe(false)
    expect(isWatchedWorkflowPath("tasks/a/prompt.md")).toBe(false)
  })
})

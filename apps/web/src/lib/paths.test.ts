import { describe, expect, it } from "vitest"
import { parseWorkflowTab, runPath, workflowPath } from "./paths"

describe("paths", () => {
  it("builds workflow and run URLs", () => {
    expect(workflowPath("demo")).toBe("/workflows/demo")
    expect(workflowPath("demo", "editor")).toBe("/workflows/demo")
    expect(workflowPath("demo", "runs")).toBe("/workflows/demo?tab=runs")
    expect(workflowPath("demo", "overview")).toBe(
      "/workflows/demo?tab=overview"
    )
    expect(runPath("r1")).toBe("/runs/r1")
  })

  it("parses known tabs and rejects unknown", () => {
    expect(parseWorkflowTab("runs")).toBe("runs")
    expect(parseWorkflowTab("editor")).toBe("editor")
    expect(parseWorkflowTab("overview")).toBe("overview")
    expect(parseWorkflowTab(null)).toBeNull()
    expect(parseWorkflowTab("nope")).toBeNull()
  })
})

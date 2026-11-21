import { describe, expect, it } from "vitest"
import {
  parseRunTaskTab,
  parseWorkflowTab,
  runPath,
  runTaskPath,
  workflowPath,
} from "./paths"

describe("paths", () => {
  it("builds workflow and run URLs", () => {
    expect(workflowPath("demo")).toBe("/workflows/demo")
    expect(workflowPath("demo", "editor")).toBe("/workflows/demo")
    expect(workflowPath("demo", "runs")).toBe("/workflows/demo?tab=runs")
    expect(workflowPath("demo", "overview")).toBe(
      "/workflows/demo?tab=overview"
    )
    expect(runPath("r1")).toBe("/runs/r1")
    expect(runTaskPath("r1", "a")).toBe("/runs/r1?task=a")
    expect(runTaskPath("r1", "a", "terminal")).toBe(
      "/runs/r1?task=a&tab=terminal"
    )
  })

  it("parses known tabs and rejects unknown", () => {
    expect(parseWorkflowTab("runs")).toBe("runs")
    expect(parseWorkflowTab("editor")).toBe("editor")
    expect(parseWorkflowTab("overview")).toBe("overview")
    expect(parseWorkflowTab(null)).toBeNull()
    expect(parseWorkflowTab("nope")).toBeNull()
    expect(parseRunTaskTab("terminal")).toBe("terminal")
    expect(parseRunTaskTab("environment")).toBe("environment")
    expect(parseRunTaskTab(null)).toBeNull()
    expect(parseRunTaskTab("logs")).toBeNull()
  })
})

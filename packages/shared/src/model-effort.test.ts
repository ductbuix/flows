import { describe, expect, it } from "vitest"
import { resolveModelEffort } from "./model-effort.ts"

describe("resolveModelEffort", () => {
  it("prefers judge, then same-cli task, then workflow", () => {
    const r = resolveModelEffort({
      judge: { model: "opus", effort: "high" },
      judgeCli: "claude",
      task: { cli: "claude", model: "sonnet", effort: "low" },
      workflowAgent: { claude: { model: "haiku", effort: "medium" } },
    })
    expect(r).toEqual({
      model: "opus",
      effort: "high",
      modelSource: "task",
    })
  })

  it("skips parent task when cli differs", () => {
    const r = resolveModelEffort({
      judgeCli: "cursor",
      task: { cli: "claude", model: "opus", effort: "max" },
      workflowAgent: { cursor: { model: "auto", effort: "medium" } },
    })
    expect(r).toEqual({
      model: "auto",
      effort: "medium",
      modelSource: "workflow",
    })
  })

  it("resolves fields independently and falls through to cli", () => {
    const r = resolveModelEffort({
      task: { cli: "claude", effort: "xhigh" },
      workflowAgent: { claude: { model: "sonnet" } },
    })
    expect(r).toEqual({
      model: "sonnet",
      effort: "xhigh",
      modelSource: "task",
    })
  })

  it("returns cli source when nothing is set", () => {
    expect(resolveModelEffort({ task: { cli: "claude" } })).toEqual({
      modelSource: "cli",
    })
  })
})

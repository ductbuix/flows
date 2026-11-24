import { describe, expect, it } from "vitest"
import { parseTaskParams } from "./task.ts"

describe("parseTaskParams", () => {
  it("reads description, subagent type and duration", () => {
    expect(
      parseTaskParams({
        toolCallId: "call_126",
        description: "Explore codebase",
        prompt: "Find auth",
        subagentType: "explore",
        durationMs: 1200,
      })
    ).toEqual({
      toolCallId: "call_126",
      description: "Explore codebase",
      prompt: "Find auth",
      subagentType: "explore",
      durationMs: 1200,
    })
  })

  it("normalizes custom subagentType objects", () => {
    expect(
      parseTaskParams({
        toolCallId: "c",
        description: "Custom",
        subagentType: { custom: "my_bot" },
      })
    ).toMatchObject({ subagentType: "my_bot" })
  })

  it("returns null when malformed", () => {
    expect(parseTaskParams({ toolCallId: "c" })).toBeNull()
  })
})

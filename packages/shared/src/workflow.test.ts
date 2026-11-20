import { describe, expect, it } from "vitest"
import { workflowSchema } from "./workflow.ts"

describe("workflowSchema", () => {
  it("accepts a diamond of command tasks", () => {
    const workflow = workflowSchema.parse({
      id: "diamond",
      goal: "a then b||c then d",
      tasks: [
        { id: "a", kind: "command", run: "echo a" },
        { id: "b", kind: "command", run: "echo b", needs: ["a"] },
        { id: "c", kind: "command", run: "echo c", needs: ["a"] },
        { id: "d", kind: "command", run: "echo d", needs: ["b", "c"] },
      ],
    })
    expect(workflow.tasks[0]?.needs).toEqual([])
    expect(workflow.tasks[3]?.needs).toEqual(["b", "c"])
  })

  it("rejects agent tasks until BL-007", () => {
    expect(
      workflowSchema.safeParse({
        id: "x",
        tasks: [{ id: "a", kind: "agent", cli: "claude" }],
      }).success
    ).toBe(false)
  })

  it("accepts approval: true on a command task", () => {
    const workflow = workflowSchema.parse({
      id: "gated",
      tasks: [{ id: "a", kind: "command", run: "echo a", approval: true }],
    })
    expect(workflow.tasks[0]?.approval).toBe(true)
  })
})

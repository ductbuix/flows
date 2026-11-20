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

  it("accepts agent tasks with cli, instructions and memory", () => {
    const workflow = workflowSchema.parse({
      id: "agents",
      limits: { agents: 2, maxTasks: 20, maxSpawnDepth: 2 },
      tasks: [
        {
          id: "plan",
          kind: "agent",
          cli: "claude",
          instructions: "tasks/plan.md",
          memory: ["memory/style.md"],
          spawn: true,
          retry: { max: 2 },
        },
        {
          id: "fetch",
          kind: "command",
          run: "echo fetch",
          needs: ["plan"],
        },
      ],
    })
    expect(workflow.tasks[0]).toMatchObject({
      kind: "agent",
      cli: "claude",
      spawn: true,
    })
  })

  it("rejects agent tasks without instructions", () => {
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

  it("accepts when, retry, repeat and branch needs", () => {
    const workflow = workflowSchema.parse({
      id: "flow",
      tasks: [
        {
          id: "a",
          kind: "command",
          run: "echo a",
          retry: {},
          when: false,
        },
        {
          id: "b",
          kind: "command",
          run: "echo b",
          needs: [{ task: "a", when: { exit: 0 } }],
          repeat: {
            until: { expr: "json('out/score.json').score >= 0.8" },
          },
          when: { all: [{ exit: 0 }, { any: [{ exit: 1 }] }] },
        },
      ],
    })
    expect(workflow.tasks[0]?.retry?.max).toBe(3)
    expect(workflow.tasks[0]?.when).toBe(false)
    expect(workflow.tasks[1]?.repeat?.max).toBe(5)
    expect(workflow.tasks[1]?.needs[0]).toEqual({
      task: "a",
      when: { exit: 0 },
    })
  })
})

import { describe, expect, it } from "vitest"
import { parseWorkflowYaml } from "./workflow-yaml.ts"
import { loneAgentJudge, workflowSchema } from "./workflow.ts"

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

  it("accepts timeout on workflow and task", () => {
    const workflow = workflowSchema.parse({
      id: "timed",
      timeout: 900,
      tasks: [{ id: "a", kind: "command", run: "echo a", timeout: 30 }],
    })
    expect(workflow.timeout).toBe(900)
    expect(workflow.tasks[0]?.timeout).toBe(30)
  })

  it("accepts agent tasks with cli, name, memory and no instructions", () => {
    const workflow = workflowSchema.parse({
      id: "agents",
      limits: { agents: 2, maxTasks: 20, maxSpawnDepth: 2 },
      tasks: [
        {
          id: "plan",
          name: "Plan",
          kind: "agent",
          cli: "claude",
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
      name: "Plan",
      spawn: true,
    })
    expect(workflow.tasks[0] && "instructions" in workflow.tasks[0]).toBe(false)
  })

  it("accepts agent tasks without a prompt field", () => {
    expect(
      workflowSchema.safeParse({
        id: "x",
        tasks: [{ id: "a", kind: "agent", cli: "claude" }],
      }).success
    ).toBe(true)
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

  it("accepts agent judge conditions without instructions", () => {
    const workflow = workflowSchema.parse({
      id: "judged",
      tasks: [
        {
          id: "a",
          kind: "command",
          run: "echo a",
          when: {
            agent: { cli: "claude" },
          },
          repeat: {
            until: {
              agent: { cli: "cursor" },
            },
          },
        },
      ],
    })
    expect(workflow.tasks[0]?.when).toEqual({
      agent: { cli: "claude" },
    })
  })

  it("loneAgentJudge returns only a top-level agent leaf", () => {
    expect(
      loneAgentJudge({ agent: { cli: "claude", model: "haiku" } })
    ).toEqual({ cli: "claude", model: "haiku" })
    expect(loneAgentJudge({ exit: 0 })).toBeUndefined()
    expect(
      loneAgentJudge({ all: [{ agent: { cli: "claude" } }] })
    ).toBeUndefined()
    expect(loneAgentJudge(false)).toBeUndefined()
    expect(loneAgentJudge(undefined)).toBeUndefined()
  })

  it("accepts inputs and maxConcurrentRuns", () => {
    const workflow = workflowSchema.parse({
      id: "with-inputs",
      limits: { maxConcurrentRuns: 2 },
      inputs: [
        {
          name: "ticket",
          type: "text",
          required: true,
          description: "Ticket key",
        },
        { name: "brief", type: "markdown", required: false, default: "" },
        { name: "attachment", type: "file", required: false },
      ],
      tasks: [{ id: "a", kind: "command", run: "echo a" }],
    })
    expect(workflow.limits?.maxConcurrentRuns).toBe(2)
    expect(workflow.inputs).toHaveLength(3)
  })

  it("rejects reserved input names and defaults on file", () => {
    expect(
      workflowSchema.safeParse({
        id: "bad",
        inputs: [{ name: "inputs", type: "text", required: true }],
        tasks: [{ id: "a", kind: "command", run: "echo" }],
      }).success
    ).toBe(false)
    expect(
      workflowSchema.safeParse({
        id: "bad",
        inputs: [{ name: "f", type: "file", required: false, default: "x" }],
        tasks: [{ id: "a", kind: "command", run: "echo" }],
      }).success
    ).toBe(false)
  })

  it("accepts task uses with read and propose access", () => {
    const workflow = workflowSchema.parse({
      id: "with-uses",
      tasks: [
        {
          id: "a",
          kind: "agent",
          cli: "claude",
          uses: [
            { connection: "rally-payments", access: "read" },
            { connection: "github-acme", access: "propose" },
          ],
        },
      ],
    })
    expect(workflow.tasks[0]?.uses).toEqual([
      { connection: "rally-payments", access: "read" },
      { connection: "github-acme", access: "propose" },
    ])
  })
})

describe("parseWorkflowYaml DES-020 checks", () => {
  it("rejects a leftover instructions key and names the target path", () => {
    const parsed = parseWorkflowYaml(`
id: x
tasks:
  - id: start
    kind: agent
    cli: claude
    instructions: tasks/start.md
`)
    expect(parsed.workflow).toBeNull()
    expect(
      parsed.errors.some((e) => e.message.includes("tasks/start/prompt.md"))
    ).toBe(true)
  })

  it("rejects unsafe task ids", () => {
    const parsed = parseWorkflowYaml(`
id: x
tasks:
  - id: a/b
    kind: command
    run: echo
`)
    expect(parsed.workflow).toBeNull()
    expect(
      parsed.errors.some((e) => e.message.includes("single path segment"))
    ).toBe(true)

    const dotted = parseWorkflowYaml(`
id: x
tasks:
  - id: .trash
    kind: command
    run: echo
`)
    expect(dotted.workflow).toBeNull()
    expect(
      dotted.errors.some((e) => e.message.includes("single path segment"))
    ).toBe(true)
  })

  it("rejects colliding UPSTREAM env names", () => {
    const parsed = parseWorkflowYaml(`
id: x
tasks:
  - id: task-a
    kind: command
    run: echo a
  - id: task_a
    kind: command
    run: echo b
`)
    expect(parsed.workflow).toBeNull()
    expect(parsed.errors.some((e) => e.message.includes("same env name"))).toBe(
      true
    )
  })

  it("rejects two agent judges in one slot", () => {
    const parsed = parseWorkflowYaml(`
id: x
tasks:
  - id: a
    kind: command
    run: echo
    when:
      any:
        - agent: { cli: claude }
        - agent: { cli: cursor }
`)
    expect(parsed.workflow).toBeNull()
    expect(
      parsed.errors.some((e) => e.message.includes("at most one agent judge"))
    ).toBe(true)
  })

  it("rejects leftover judge instructions and names the slot path", () => {
    const parsed = parseWorkflowYaml(`
id: x
tasks:
  - id: a
    kind: command
    run: echo
    when:
      agent:
        cli: claude
        instructions: tasks/old.md
`)
    expect(parsed.workflow).toBeNull()
    expect(
      parsed.errors.some((e) => e.message.includes("tasks/a/when.md"))
    ).toBe(true)
  })
})

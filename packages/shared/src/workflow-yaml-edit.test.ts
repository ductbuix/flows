import { describe, expect, it } from "vitest"
import { parse as parseYaml } from "yaml"
import { workflowSchema } from "./workflow.ts"
import {
  addTask,
  removeTask,
  renameTask,
  roundTripYaml,
  setApproval,
  setRetryMax,
  setTaskNeeds,
} from "./workflow-yaml-edit.ts"
import { switchTaskKind } from "./workflow-yaml-kind.ts"
import { replaceMemoryRef } from "./workflow-yaml-memory.ts"
import { parseWorkflowYaml } from "./workflow-yaml.ts"

const fixture = `# header: research workflow
id: research
goal: Produce a report # inline on goal
limits: { concurrency: 2, agents: 1 }
tasks:
  # first task is the planner
  - id: plan
    kind: agent
    cli: claude
    instructions: tasks/plan.md
    spawn: true
    retry: { max: 2 }
  - id: fetch
    kind: command
    run: node scripts/fetch.js
    needs: [plan]
    # between-key comment lives above continueOnError in source order below
    continueOnError: false
  - id: publish
    kind: command
    run: cp -r out/* "$WF_OUTPUT/"
    needs:
      - task: fetch
        when: { exit: 0 }
`

describe("workflow yaml Document edits (DES-013)", () => {
  it("round trip with no edits returns the input exactly", () => {
    expect(roundTripYaml(fixture)).toBe(fixture)
  })

  it("add, remove, rename, needs, retry and approval keep comments and order", () => {
    let text = fixture

    text = addTask(text, {
      id: "check",
      kind: "command",
      run: "python check.py",
      needs: ["fetch"],
    })
    expect(text).toContain("# header: research workflow")
    expect(text).toContain("# inline on goal")
    expect(text).toContain("# first task is the planner")
    expect(text).toMatch(/retry:\s*\{\s*max:\s*2\s*\}/)

    text = setTaskNeeds(text, "check", ["fetch", "plan"])
    text = setRetryMax(text, "plan", 3)
    text = setApproval(text, "publish", true)
    text = renameTask(text, "fetch", "gather")
    text = removeTask(text, "check")

    expect(text).toContain("# header: research workflow")
    expect(text).toContain("# inline on goal")
    expect(text).toContain("# first task is the planner")
    expect(text).toContain("id: gather")
    expect(text).not.toContain("\nid: fetch\n")
    expect(text).toMatch(/needs:\s*\[\s*plan\s*\]/)
    expect(text).toContain("approval: true")
    expect(text).toMatch(/retry:\s*\{\s*max:\s*3\s*\}/)
    expect(text).toMatch(/when:\s*\{\s*exit:\s*0\s*\}/)
    // Untouched agent keys keep order and values.
    expect(text).toContain("instructions: tasks/plan.md")
    expect(text).toContain("cli: claude")
    expect(text).toContain("continueOnError: false")

    const parsed = workflowSchema.parse(parseYaml(text))
    expect(parsed.tasks.map((t) => t.id)).toEqual(["plan", "gather", "publish"])
    expect(parsed.tasks.find((t) => t.id === "plan")?.retry).toEqual({ max: 3 })
    expect(parsed.tasks.find((t) => t.id === "publish")?.approval).toBe(true)
    expect(parsed.tasks.find((t) => t.id === "gather")?.needs).toEqual(["plan"])
    const pubNeeds = parsed.tasks.find((t) => t.id === "publish")?.needs
    expect(pubNeeds).toEqual([{ task: "gather", when: { exit: 0 } }])
  })

  it("maps zod errors to source ranges", () => {
    const bad = `id: x\ntasks:\n  - id: a\n    kind: command\n`
    const { errors, workflow } = parseWorkflowYaml(bad)
    expect(workflow).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.from >= 0 && e.to > e.from)).toBe(true)
  })

  it("replaceMemoryRef updates task memory paths", () => {
    const text = `id: x
tasks:
  - id: plan
    kind: agent
    cli: claude
    instructions: tasks/plan.md
    memory: [memory/style.md]
`
    const next = replaceMemoryRef(text, "memory/style.md", "memory/voice.md")
    expect(next).toContain("memory/voice.md")
    expect(next).not.toContain("memory/style.md")
  })

  it("switchTaskKind writes a valid agent or command shape", () => {
    let text = fixture
    text = switchTaskKind(text, "fetch", "agent")
    // Other tasks and file-level comments stay (DES-018).
    expect(text).toContain("# header: research workflow")
    expect(text).toContain("# inline on goal")
    expect(text).toContain("# first task is the planner")
    expect(text).toMatch(/instructions:\s*tasks\/plan\.md/)
    expect(text).toMatch(/when:\s*\{\s*exit:\s*0\s*\}/)

    const toAgent = workflowSchema.parse(parseYaml(text))
    const fetch = toAgent.tasks.find((t) => t.id === "fetch")
    expect(fetch).toMatchObject({
      kind: "agent",
      cli: "claude",
      instructions: "tasks/fetch.md",
      needs: ["plan"],
      continueOnError: false,
    })
    expect(fetch && "run" in fetch).toBe(false)
    expect(toAgent.tasks.map((t) => t.id)).toEqual(["plan", "fetch", "publish"])

    text = switchTaskKind(text, "fetch", "command")
    expect(text).toContain("# header: research workflow")
    expect(text).toContain("# first task is the planner")
    const toCommand = workflowSchema.parse(parseYaml(text))
    const cmd = toCommand.tasks.find((t) => t.id === "fetch")
    expect(cmd).toMatchObject({
      kind: "command",
      run: "echo ok",
      needs: ["plan"],
      continueOnError: false,
    })
    expect(cmd && "cli" in cmd).toBe(false)
    expect(cmd && "instructions" in cmd).toBe(false)
    expect(cmd && "memory" in cmd).toBe(false)
    expect(cmd && "spawn" in cmd).toBe(false)
  })
})

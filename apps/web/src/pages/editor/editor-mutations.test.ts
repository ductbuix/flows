import { describe, expect, it } from "vitest"
import { parseWorkflowYaml } from "@workspace/shared"
import { yamlAfterTaskPatch } from "./editor-mutations"

const yaml = `id: demo
# keep me
tasks:
  # first
  - id: alpha
    kind: command
    run: echo a
    approval: true
  - id: beta
    kind: command
    run: echo b
    needs: [alpha]
`

describe("yamlAfterTaskPatch kind switch", () => {
  it("replaces a command task with a valid agent shape", () => {
    const { workflow } = parseWorkflowYaml(yaml)
    expect(workflow).not.toBeNull()
    const next = yamlAfterTaskPatch(yaml, workflow!, "alpha", {
      kind: "agent",
    })
    expect(next.yaml).toContain("# keep me")
    expect(next.yaml).toContain("# first")
    expect(next.yaml).toContain("id: beta")
    expect(next.yaml).toContain("run: echo b")
    const parsed = parseWorkflowYaml(next.yaml)
    expect(parsed.workflow).not.toBeNull()
    expect(parsed.errors).toEqual([])
    const alpha = parsed.workflow!.tasks.find((t) => t.id === "alpha")
    expect(alpha).toMatchObject({
      kind: "agent",
      cli: "claude",

      approval: true,
    })
    expect(alpha && "run" in alpha).toBe(false)
    const beta = parsed.workflow!.tasks.find((t) => t.id === "beta")
    expect(beta).toMatchObject({ kind: "command", run: "echo b" })
  })

  it("keeps an optimistic task when a required field is cleared", () => {
    const { workflow } = parseWorkflowYaml(yaml)
    const next = yamlAfterTaskPatch(yaml, workflow!, "beta", { run: "" })
    const beta = next.workflow.tasks.find((t) => t.id === "beta")
    expect(beta).toMatchObject({ kind: "command", run: "" })
    expect(parseWorkflowYaml(next.yaml).workflow).toBeNull()
  })
})

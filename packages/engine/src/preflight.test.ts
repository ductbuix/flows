import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadWorkflowFile } from "./workflow.ts"
import { hasWarning, runPreflightChecks } from "./preflight.ts"
import { resolveAppHomeRealpath } from "./paths.ts"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("preflight checks", () => {
  it("returns pass or warn for each check and never blocks", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-pf-"))
    dirs.push(home)
    const wf = join(home, "workflows", "agent-hi")
    mkdirSync(join(wf, "tasks", "a"), { recursive: true })
    writeFileSync(join(wf, "tasks", "a", "prompt.md"), "hi\n")
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: agent-hi
tasks:
  - id: a
    kind: agent
    cli: cursor
`
    )
    const workflow = loadWorkflowFile(wf)
    const checks = await runPreflightChecks({
      homeRealpath: resolveAppHomeRealpath(home),
      home,
      workflowDir: wf,
      workflow,
    })
    expect(checks.length).toBeGreaterThan(2)
    expect(
      checks.every((c) => c.status === "pass" || c.status === "warn")
    ).toBe(true)
    expect(checks.some((c) => c.id === "flags_cursor")).toBe(true)
    expect(checks.find((c) => c.id === "flags_cursor")?.message).toMatch(
      /--force/
    )
    expect(checks.find((c) => c.id === "prompts")?.status).toBe("pass")
    void hasWarning(checks)
  })

  it("warns when an authored agent prompt is missing", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-pf-miss-"))
    dirs.push(home)
    const wf = join(home, "workflows", "agent-miss")
    mkdirSync(wf, { recursive: true })
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: agent-miss
tasks:
  - id: a
    kind: agent
    cli: claude
`
    )
    const workflow = loadWorkflowFile(wf)
    const checks = await runPreflightChecks({
      homeRealpath: resolveAppHomeRealpath(home),
      home,
      workflowDir: wf,
      workflow,
    })
    const prompts = checks.find((c) => c.id === "prompts")
    expect(prompts?.status).toBe("warn")
    expect(prompts?.message).toContain("tasks/a/prompt.md")
  })

  it("lists resolved model/effort and warns on unknown model", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-pf-model-"))
    dirs.push(home)
    const wf = join(home, "workflows", "agent-model")
    mkdirSync(join(wf, "tasks", "a"), { recursive: true })
    writeFileSync(join(wf, "tasks", "a", "prompt.md"), "hi\n")
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: agent-model
tasks:
  - id: a
    kind: agent
    cli: claude
    model: not-a-real-model
    effort: high
`
    )
    const workflow = loadWorkflowFile(wf)
    const checks = await runPreflightChecks({
      homeRealpath: resolveAppHomeRealpath(home),
      home,
      workflowDir: wf,
      workflow,
    })
    const listed = checks.find((c) => c.id === "model_effort")
    expect(listed?.status).toBe("pass")
    expect(listed?.message).toContain("task a")
    expect(listed?.message).toContain("not-a-real-model")
    expect(listed?.message).toContain("high")
    const warn = checks.find(
      (c) => c.status === "warn" && c.id.startsWith("model_effort_")
    )
    expect(warn?.message).toMatch(/not-a-real-model/)
  })
})

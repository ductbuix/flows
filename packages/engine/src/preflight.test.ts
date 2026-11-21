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
    mkdirSync(join(wf, "tasks"), { recursive: true })
    writeFileSync(join(wf, "tasks", "a.md"), "hi\n")
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: agent-hi
tasks:
  - id: a
    kind: agent
    cli: cursor
    instructions: tasks/a.md
`
    )
    const workflow = loadWorkflowFile(wf)
    const checks = await runPreflightChecks({
      homeRealpath: resolveAppHomeRealpath(home),
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
    void hasWarning(checks)
  })
})

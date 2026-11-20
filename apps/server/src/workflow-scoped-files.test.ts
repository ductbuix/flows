import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEngine } from "@workspace/engine"
import { afterEach, describe, expect, it } from "vitest"
import { resolveWorkflowFilePath } from "./workflow-scoped-files.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

describe("resolveWorkflowFilePath", () => {
  it("rejects traversal and absolute paths", () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-resolve-"))
    homes.push(home)
    const engine = createEngine({ home })
    expect(resolveWorkflowFilePath(engine, "wf", "../x.md")).toBeNull()
    expect(resolveWorkflowFilePath(engine, "wf", "tasks/../x.md")).toBeNull()
    expect(resolveWorkflowFilePath(engine, "wf", "/etc/passwd")).toBeNull()
    expect(resolveWorkflowFilePath(engine, "wf", "a\\b.md")).toBeNull()
    expect(resolveWorkflowFilePath(engine, "wf", "workflow.yaml")).toBeNull()
    expect(resolveWorkflowFilePath(engine, "wf", "runs/a/b")).toBeNull()
    expect(resolveWorkflowFilePath(engine, "wf", "tasks/plan.md")).toMatch(
      /tasks[/\\]plan\.md$/
    )
    engine.close()
  })
})

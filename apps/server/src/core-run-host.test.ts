import { mkdirSync, writeFileSync } from "node:fs"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseNodeWorkflowYaml } from "@workspace/contracts"
import { createEngine } from "@workspace/engine"
import { createCoreRunHost } from "./core-run-host.ts"
import { isCoreRunEligible } from "./core-run-eligible.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-core-run-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, yaml: string): void {
  const parsed = parseNodeWorkflowYaml(yaml)
  const id = parsed.workflow!.id
  const dir = join(home, "workflows", id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml)
}

describe("isCoreRunEligible", () => {
  it("accepts trigger+command only", () => {
    const ok = parseNodeWorkflowYaml(`
id: demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: command, run: "true" }
edges:
  - { from: t, to: a }
`).workflow!
    expect(isCoreRunEligible(ok)).toBe(true)

    const approval = parseNodeWorkflowYaml(`
id: other
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: approval, question: "Go?" }
edges:
  - { from: t, to: a }
`).workflow!
    expect(isCoreRunEligible(approval)).toBe(false)
  })
})

describe("createCoreRunHost", () => {
  it("executes a command run on the core actor; fold matches engine", async () => {
    const home = tempHome()
    writeWorkflow(
      home,
      `
id: demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "printf hi > \\"$NODE_OUT/out.txt\\"; printf done"
edges:
  - { from: t, to: a }
`
    )
    const engine = createEngine({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(
      `
id: demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "printf hi > \\"$NODE_OUT/out.txt\\"; printf done"
edges:
  - { from: t, to: a }
`
    ).workflow!

    const runId = "core-r1"
    const started = await host.tryStart({ graph, runId })
    expect(started).toEqual({ runId })

    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const summary = engine.getRunSummary(runId)
      if (summary?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }

    const summary = engine.getRunSummary(runId)
    expect(summary).toMatchObject({
      id: runId,
      workflowId: "demo",
      status: "succeeded",
      taskCounts: { done: 2, total: 2 },
    })

    const types = engine.events(runId).map((e) => e.type)
    expect(types[0]).toBe("run_started")
    expect(types).toContain("attempt_started")
    expect(types).toContain("step_done")
    expect(types.at(-1)).toBe("run_succeeded")

    host.dispose()
    engine.close()
  })
})

import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseNodeWorkflowYaml } from "@workspace/contracts"
import { createEngine } from "@workspace/adapters-node"
import { createCoreRunHost } from "./core-run-host.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-core-cancel-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, yaml: string): void {
  const id = parseNodeWorkflowYaml(yaml).workflow!.id
  const dir = join(home, "workflows", id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml)
}

const slowYaml = `
id: slow
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "sleep 60"
edges:
  - { from: t, to: a }
`

const fastYaml = `
id: fast
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "echo hi"
  - { id: o, kind: output, target: folder }
edges:
  - { from: t, to: a }
  - { from: a, to: o }
`

describe("core run after prior run (storeSeq)", () => {
  it("completes a fast run after cancelling a sleep on the same store", async () => {
    const home = tempHome()
    writeWorkflow(home, slowYaml)
    writeWorkflow(home, fastYaml)
    const engine = createEngine({ home })
    const host = createCoreRunHost(engine)
    const slow = parseNodeWorkflowYaml(slowYaml).workflow!
    const fast = parseNodeWorkflowYaml(fastYaml).workflow!

    expect(await host.tryStart({ graph: slow, runId: "slow-1" })).toEqual({
      runId: "slow-1",
    })
    await new Promise((r) => setTimeout(r, 200))
    expect(await host.cancel("slow-1")).toBe(true)

    expect(await host.tryStart({ graph: fast, runId: "fast-1" })).toEqual({
      runId: "fast-1",
    })
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      if (engine.getRunSummary("fast-1")?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary("fast-1")).toMatchObject({
      status: "succeeded",
      taskCounts: { done: 3, total: 3 },
    })
    host.dispose()
    engine.close()
  }, 15_000)
})

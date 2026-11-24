import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseNodeWorkflowYaml } from "@workspace/contracts"
import { createHost } from "@workspace/adapters-node"
import { createCoreRunHost } from "./core-run-host.ts"

const homes: string[] = []
afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-core-resume-"))
  homes.push(home)
  return home
}

describe("core run resume after host restart (BL-196)", () => {
  it("kills the host mid-run and resumes without re-running finished steps", async () => {
    const home = tempHome()
    const yaml = `
id: resume-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: first, kind: command, run: "printf one > \\"$NODE_OUT/a.txt\\"; printf done" }
  - { id: slow, kind: command, run: "sleep 8 && printf two > \\"$NODE_OUT/b.txt\\"; printf done" }
edges:
  - { from: t, to: first }
  - { from: first, to: slow }
`
    mkdirSync(join(home, "workflows", "resume-demo"), { recursive: true })
    writeFileSync(join(home, "workflows", "resume-demo", "workflow.yaml"), yaml)
    const engine = createHost({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!
    const runId = "mid-1"
    expect(await host.tryStart({ graph, runId })).toEqual({ runId })

    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const types = engine.events(runId).map((e) => e.type)
      const firstDone = engine
        .events(runId)
        .some(
          (e) =>
            e.type === "step_done" &&
            "nodeId" in e &&
            e.nodeId === "first" &&
            !e.reused
        )
      if (firstDone && types.includes("step_started")) break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(
      engine
        .events(runId)
        .some((e) => e.type === "step_done" && e.nodeId === "first")
    ).toBe(true)

    // Kill the host without appending cancel (daemon crash).
    host.abandon()
    engine.close()

    const again = createHost({ home })
    const host2 = createCoreRunHost(again)
    await host2.resumeAll()

    const doneBy = Date.now() + 15_000
    while (Date.now() < doneBy) {
      if (again.getRunSummary(runId)?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(again.getRunSummary(runId)?.status).toBe("succeeded")

    const firstDones = again
      .events(runId)
      .filter((e) => e.type === "step_done" && e.nodeId === "first")
    // Finished step must not be re-executed (one step_done, not two).
    expect(firstDones).toHaveLength(1)
    expect(
      again
        .events(runId)
        .some((e) => e.type === "step_done" && e.nodeId === "slow")
    ).toBe(true)

    host2.dispose()
    again.close()
  }, 30_000)
})

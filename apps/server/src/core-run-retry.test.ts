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

describe("core retry_step (BL-196)", () => {
  it("retries a failed step and finishes the run", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-core-retry-"))
    homes.push(home)
    const flag = join(home, "fail-once")
    writeFileSync(flag, "1")
    const yaml = `
id: retry-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: work
    kind: command
    run: "if [ -f \\"${flag}\\" ]; then rm \\"${flag}\\"; exit 1; fi; echo ok"
edges:
  - { from: t, to: work }
`
    mkdirSync(join(home, "workflows", "retry-demo"), { recursive: true })
    writeFileSync(join(home, "workflows", "retry-demo", "workflow.yaml"), yaml)
    const engine = createHost({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!
    const runId = "retry-1"

    expect(await host.tryStart({ graph, runId })).toEqual({ runId })
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (engine.getRunSummary(runId)?.status === "failed") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary(runId)?.status).toBe("failed")

    expect(await host.retryStep(runId, "work")).toBe(true)
    while (Date.now() < deadline + 10_000) {
      if (engine.getRunSummary(runId)?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary(runId)?.status).toBe("succeeded")
    expect(
      engine.events(runId).some((e) => e.type === "step_retry_requested")
    ).toBe(true)

    host.dispose()
    engine.close()
  })
})

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
  const home = mkdtempSync(join(tmpdir(), "flowapp-core-queue-"))
  homes.push(home)
  return home
}

const yaml = `
id: q1
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: command, run: "sleep 0.25 && echo ok" }
  - { id: o, kind: output, target: folder }
edges:
  - { from: t, to: a }
  - { from: a, to: o }
`

describe("core run queue activation (BL-196)", () => {
  it("queues a second run and activates it with run_activated", async () => {
    const home = tempHome()
    mkdirSync(join(home, "workflows", "q1"), { recursive: true })
    writeFileSync(join(home, "workflows", "q1", "workflow.yaml"), yaml)
    const engine = createHost({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!

    expect(await host.tryStart({ graph, runId: "a" })).toEqual({ runId: "a" })
    expect(await host.tryStart({ graph, runId: "b" })).toEqual({ runId: "b" })
    expect(engine.fold("b")?.status).toBe("queued")

    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      if (engine.getRunSummary("b")?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary("a")?.status).toBe("succeeded")
    expect(engine.getRunSummary("b")?.status).toBe("succeeded")
    expect(engine.events("b").some((e) => e.type === "run_activated")).toBe(
      true
    )
    host.dispose()
    engine.close()
  })

  it("cancels a queued run without activating it", async () => {
    const home = tempHome()
    mkdirSync(join(home, "workflows", "q1"), { recursive: true })
    writeFileSync(join(home, "workflows", "q1", "workflow.yaml"), yaml)
    const engine = createHost({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!

    await host.tryStart({ graph, runId: "live" })
    await host.tryStart({ graph, runId: "wait" })
    expect(engine.fold("wait")?.status).toBe("queued")
    expect(await host.cancel("wait")).toBe(true)
    expect(engine.fold("wait")?.status).toBe("cancelled")
    expect(await host.cancel("live")).toBe(true)
    host.dispose()
    engine.close()
  })
})

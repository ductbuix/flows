import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseNodeWorkflowYaml } from "@workspace/contracts"
import { createEngine } from "@workspace/engine"
import { createCoreRunHost } from "./core-run-host.ts"

const homes: string[] = []
afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

const yaml = `
id: wf
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: p, kind: prompt }
  - { id: o, kind: output, target: folder }
edges:
  - { from: t, to: o }
  - { from: p, to: o }
`

describe("core partial runs (BL-196)", () => {
  it("only=o runs the output on seeded upstream", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-core-partial-"))
    homes.push(home)
    const wf = join(home, "workflows", "wf")
    mkdirSync(join(wf, "nodes", "p"), { recursive: true })
    writeFileSync(join(wf, "workflow.yaml"), yaml)
    writeFileSync(join(wf, "nodes", "p", "text.md"), "house rules")

    const engine = createEngine({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!

    expect(
      await host.tryStart({ graph, runId: "r1", inputText: "story" })
    ).toEqual({ runId: "r1" })
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (engine.getRunSummary("r1")?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary("r1")?.status).toBe("succeeded")

    expect(
      await host.tryStart({
        graph,
        runId: "r2",
        partial: { only: "o", bases: ["r1"] },
      })
    ).toEqual({ runId: "r2" })
    while (Date.now() < deadline + 10_000) {
      if (engine.getRunSummary("r2")?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary("r2")?.status).toBe("succeeded")
    const started = engine
      .events("r2")
      .filter((e) => e.type === "step_started")
      .map((e) => (e as { nodeId: string }).nodeId)
    expect(started).toEqual(["o"])
    expect(engine.events("r2")[0]).toMatchObject({ only: "o" })
    expect(
      readFileSync(join(wf, "runs", "r2", "output", "p", "text.md"), "utf8")
    ).toBe("house rules")

    host.dispose()
    engine.close()
  })
})

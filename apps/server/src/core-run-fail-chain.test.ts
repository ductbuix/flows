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

describe("core fail then skip chain (BL-196)", () => {
  it("ends the run after skipping nodes below a failed step", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-fail-chain-"))
    homes.push(home)
    const yaml = `
id: fail-chain
nodes:
  - { id: start, kind: trigger, type: manual }
  - id: build
    kind: command
    run: "echo broken >&2; exit 1"
  - { id: talk, kind: llm, cli: claude }
  - { id: done, kind: output, target: folder }
edges:
  - { from: start, to: build }
  - { from: build, to: talk }
  - { from: talk, to: done }
`
    mkdirSync(join(home, "workflows/fail-chain/nodes/talk"), {
      recursive: true,
    })
    writeFileSync(join(home, "workflows/fail-chain/workflow.yaml"), yaml)
    writeFileSync(
      join(home, "workflows/fail-chain/nodes/talk/prompt.md"),
      "unused\n"
    )
    const engine = createHost({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!
    await host.tryStart({ graph, runId: "r1" })
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (engine.getRunSummary("r1")?.status === "failed") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary("r1")?.status).toBe("failed")
    const types = engine.events("r1").map((e) => e.type)
    expect(types).toContain("step_failed")
    expect(types).toContain("step_skipped")
    expect(types.at(-1)).toBe("run_failed")
    host.abandon()
    engine.close()
  })
})

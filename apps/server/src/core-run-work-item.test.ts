import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/contracts"
import { createEngine } from "@workspace/adapters-node"
import { createCoreRunHost } from "./core-run-host.ts"

const homes: string[] = []
afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

const graph = workflowSchema.parse({
  id: "wi-wf",
  nodes: [
    { id: "t", kind: "trigger", type: "manual" },
    { id: "a", kind: "command", run: "echo ok" },
    { id: "o", kind: "output", target: "folder" },
  ],
  edges: [
    { from: "t", to: "a" },
    { from: "a", to: "o" },
  ],
})

describe("core runs carry workItemId (BL-197)", () => {
  it("records workItemId on run_started and in the summary", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-core-wi-"))
    homes.push(home)
    const engine = createEngine({ home })
    const host = createCoreRunHost(engine)
    // TODO(BL-213): opaque card id; work-item store no longer required.
    const workItemId = "card_story_one"

    await host.tryStart({
      graph,
      runId: "r1",
      inputText: "T-1",
      workItemId,
    })
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const s = engine.fold("r1")
      if (s && s.status !== "running" && s.status !== "queued") break
      await new Promise((r) => setTimeout(r, 25))
    }

    expect(engine.fold("r1")?.workItemId).toBe(workItemId)
    const summary = engine.listRunSummaries({ workItemId })
    expect(summary).toHaveLength(1)
    expect(summary[0]).toMatchObject({ id: "r1", workItemId })
    expect(engine.listRunSummaries({ workItemId: "other" })).toEqual([])
    host.dispose()
    engine.close()
  }, 15_000)
})

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/shared"
import { createEngine } from "./engine.ts"
import { createWorkItem } from "./workitems.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-wi-run-"))
  homes.push(home)
  return home
}

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

describe("runs carry workItemId", () => {
  it("records workItemId on run_started and in the summary", async () => {
    const home = tempHome()
    const engine = createEngine({ home })
    const { item } = createWorkItem(home, { title: "Story one" })

    const handle = engine.startNodeRun({
      graph,
      runId: "r1",
      inputText: "T-1",
      workItemId: item.id,
    })
    await handle.wait()

    expect(engine.fold("r1")?.workItemId).toBe(item.id)

    const summary = engine.listRunSummaries({ workItemId: item.id })
    expect(summary).toHaveLength(1)
    expect(summary[0]).toMatchObject({ id: "r1", workItemId: item.id })
    expect(engine.listRunSummaries({ workItemId: "other" })).toEqual([])
    engine.close()
  })
})

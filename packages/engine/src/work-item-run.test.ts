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
import { createEngine } from "./engine.ts"
import { foldEvents } from "./fold.ts"
import { workItemItemKey } from "./item-key.ts"
import { runDir } from "./paths.ts"
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

function writeWorkflow(home: string, id: string, body: string): string {
  const wf = join(home, "workflows", id)
  mkdirSync(wf, { recursive: true })
  writeFileSync(join(wf, "workflow.yaml"), body)
  return wf
}

describe("runs carry workItemId", () => {
  it("records workItemId on run_started, inputs.json and summary", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "wi-wf",
      `
id: wi-wf
inputs:
  - name: ticket
    type: text
    required: true
tasks:
  - id: a
    kind: command
    run: echo ok
`
    )
    const engine = createEngine({ home })
    const { item } = createWorkItem(home, { title: "Story one" })

    const handle = engine.startRun({
      workflowDir: wf,
      runId: "r1",
      values: { ticket: "T-1" },
      workItemId: item.id,
    })
    await handle.wait()

    const state = engine.fold("r1")
    expect(state?.workItemId).toBe(item.id)
    expect(state?.itemKey).toBe(workItemItemKey(item.id))

    const meta = JSON.parse(
      readFileSync(join(runDir(wf, "r1"), "input", "inputs.json"), "utf8")
    )
    expect(meta.workItemId).toBe(item.id)
    expect(meta.itemKey).toBe(workItemItemKey(item.id))

    const summary = engine.listRunSummaries({ workItemId: item.id })
    expect(summary).toHaveLength(1)
    expect(summary[0]).toMatchObject({
      id: "r1",
      workItemId: item.id,
      itemKey: workItemItemKey(item.id),
    })
    expect(engine.listRunSummaries({ workItemId: "other" })).toEqual([])
    engine.close()
  })

  it("derives the same itemKey for one work item despite different values", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "wi-wf",
      `
id: wi-wf
limits:
  maxConcurrentRuns: 2
inputs:
  - name: ticket
    type: text
    required: true
tasks:
  - id: a
    kind: command
    run: echo ok
`
    )
    const engine = createEngine({ home })
    const { item } = createWorkItem(home, { title: "Same item" })

    await engine
      .startRun({
        workflowDir: wf,
        runId: "a",
        values: { ticket: "first" },
        workItemId: item.id,
      })
      .wait()
    await engine
      .startRun({
        workflowDir: wf,
        runId: "b",
        values: { ticket: "second" },
        workItemId: item.id,
      })
      .wait()

    expect(engine.fold("a")?.itemKey).toBe(engine.fold("b")?.itemKey)
    expect(engine.fold("a")?.itemKey).toBe(workItemItemKey(item.id))
    engine.close()
  })

  it("folds older run_started events that omit workItemId", () => {
    const state = foldEvents([
      {
        type: "run_started",
        runId: "old",
        workflowId: "w",
        graph: {
          id: "w",
          tasks: [{ id: "a", kind: "command", run: "echo", needs: [] }],
        },
        at: "2026-01-01T00:00:00.000Z",
        source: "manual",
        itemKey: "legacy-key",
      },
    ])
    expect(state?.itemKey).toBe("legacy-key")
    expect(state?.workItemId).toBeUndefined()
  })
})

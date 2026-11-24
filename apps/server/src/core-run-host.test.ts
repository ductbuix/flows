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
  it("accepts ported kinds; rejects loops, llm and publish", () => {
    const ok = parseNodeWorkflowYaml(`
id: demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: command, run: "true" }
edges:
  - { from: t, to: a }
`).workflow!
    expect(isCoreRunEligible(ok)).toBe(true)

    // Prompt/asset have no in-ports; they run as sources beside the trigger.
    const prompt = parseNodeWorkflowYaml(`
id: prompt-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: p, kind: prompt }
`).workflow!
    expect(isCoreRunEligible(prompt)).toBe(true)

    const asset = parseNodeWorkflowYaml(`
id: asset-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: asset
    resources:
      - { connection: demo, entity: item, id: alpha }
`).workflow!
    expect(isCoreRunEligible(asset)).toBe(true)

    const approval = parseNodeWorkflowYaml(`
id: other
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: approval, question: "Go?" }
edges:
  - { from: t, to: a }
`).workflow!
    expect(isCoreRunEligible(approval)).toBe(true)

    const notify = parseNodeWorkflowYaml(`
id: notify-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: n, kind: output, target: notify, title: Hi }
edges:
  - { from: t, to: n }
`).workflow!
    expect(isCoreRunEligible(notify)).toBe(true)

    const folder = parseNodeWorkflowYaml(`
id: folder-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: o, kind: output, target: folder }
edges:
  - { from: t, to: o }
`).workflow!
    expect(isCoreRunEligible(folder)).toBe(true)

    const llm = parseNodeWorkflowYaml(`
id: llm-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: l, kind: llm, cli: cursor }
edges:
  - { from: t, to: l }
`).workflow!
    expect(isCoreRunEligible(llm)).toBe(false)

    const loop = parseNodeWorkflowYaml(`
id: loop-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: command, run: "true" }
  - { id: b, kind: command, run: "true" }
edges:
  - { from: t, to: a }
  - { from: a, to: b }
  - { from: b, to: a }
`).workflow!
    expect(isCoreRunEligible(loop)).toBe(false)
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

  it("posts a notify notice via the engine notices table", async () => {
    const home = tempHome()
    const yaml = `
id: notify-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: n, kind: output, target: notify, title: Ready }
edges:
  - { from: t, to: n }
`
    writeWorkflow(home, yaml)
    const engine = createEngine({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!

    const runId = "core-notify"
    expect(
      await host.tryStart({ graph, runId, inputText: "all green" })
    ).toEqual({ runId })

    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (engine.getRunSummary(runId)?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary(runId)?.status).toBe("succeeded")
    const { notices } = engine.listNotices()
    expect(notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Ready",
          text: expect.stringContaining("all green"),
          runId,
          nodeId: "n",
        }),
      ])
    )
    host.dispose()
    engine.close()
  })

  it("answers an approval on the live core actor", async () => {
    const home = tempHome()
    const yaml = `
id: ask-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: gate, kind: approval, question: Ship it? }
edges:
  - { from: t, to: gate }
`
    writeWorkflow(home, yaml)
    const engine = createEngine({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!
    const runId = "core-ask"
    expect(await host.tryStart({ graph, runId, inputText: "payload" })).toEqual(
      {
        runId,
      }
    )

    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (host.isLive(runId)) {
        const types = engine.events(runId).map((e) => e.type)
        if (types.includes("approval_requested")) break
      }
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(host.isLive(runId)).toBe(true)
    expect(
      await host.answerApproval({
        runId,
        nodeId: "gate",
        decision: "approved",
      })
    ).toBe(true)

    while (Date.now() < deadline) {
      if (engine.getRunSummary(runId)?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary(runId)?.status).toBe("succeeded")
    host.dispose()
    engine.close()
  })
})

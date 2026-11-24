import { mkdirSync, writeFileSync } from "node:fs"
import { mkdtempSync, rmSync } from "node:fs"
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
    const engine = createHost({ home })
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

  it("runs trigger+command+folder output to completion", async () => {
    const home = tempHome()
    const yaml = `
id: diamond
nodes:
  - { id: start, kind: trigger, type: manual }
  - { id: build, kind: command, run: "echo diamond" }
  - { id: done, kind: output, target: folder }
edges:
  - { from: start, to: build }
  - { from: build, to: done }
`
    writeWorkflow(home, yaml)
    const engine = createHost({ home })
    const host = createCoreRunHost(engine)
    const graph = parseNodeWorkflowYaml(yaml).workflow!
    const runId = "core-diamond"
    expect(await host.tryStart({ graph, runId })).toEqual({ runId })

    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (engine.getRunSummary(runId)?.status === "succeeded") break
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(engine.getRunSummary(runId)).toMatchObject({
      status: "succeeded",
      taskCounts: { done: 3, total: 3 },
    })
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
    const engine = createHost({ home })
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
    const engine = createHost({ home })
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

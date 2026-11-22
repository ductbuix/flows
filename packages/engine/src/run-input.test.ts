import {
  existsSync,
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
import { runDir } from "./paths.ts"
import { runInputDir } from "./run-input.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-input-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, id: string, body: string): string {
  const wf = join(home, "workflows", id)
  mkdirSync(join(wf, "input"), { recursive: true })
  writeFileSync(join(wf, "input", "default.txt"), "shared\n")
  writeFileSync(join(wf, "workflow.yaml"), body)
  return wf
}

describe("run input materialize", () => {
  it("copies WF_INPUT and writes inputs.json; tasks see RUN_INPUT", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "in1",
      `
id: in1
inputs:
  - name: ticket
    type: text
    required: true
tasks:
  - id: a
    kind: command
    run: "test -f \\"$RUN_INPUT/inputs.json\\" && test -f \\"$RUN_INPUT/ticket.txt\\" && echo ok"
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({
      workflowDir: wf,
      runId: "r1",
      values: { ticket: " ABC-1 " },
    })
    expect(handle.status).toBe("running")
    const input = runInputDir(runDir(wf, "r1"))
    expect(existsSync(join(input, "default.txt"))).toBe(true)
    expect(readFileSync(join(input, "ticket.txt"), "utf8")).toBe("ABC-1")
    const meta = JSON.parse(readFileSync(join(input, "inputs.json"), "utf8"))
    expect(meta.source).toBe("manual")
    expect(meta.itemKeyVersion).toBe(1)
    expect(meta.fields.ticket).toEqual({ type: "text", value: "ABC-1" })
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    expect(engine.fold("r1")?.itemKey).toBe(meta.itemKey)
    engine.close()
  })

  it("queues a second run when maxConcurrentRuns is omitted (default 1)", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "q1",
      `
id: q1
tasks:
  - id: a
    kind: command
    run: "sleep 0.3 && echo ok"
`
    )
    const engine = createEngine({ home })
    const first = await engine.startRun({ workflowDir: wf, runId: "a" })
    const second = await engine.startRun({ workflowDir: wf, runId: "b" })
    expect(first.status).toBe("running")
    expect(second.status).toBe("queued")
    expect(engine.fold("b")?.status).toBe("queued")
    expect(engine.hasLiveRun("q1")).toBe(true)
    await first.wait()
    await second.wait()
    expect(engine.fold("b")?.status).toBe("succeeded")
    expect(engine.events("b").some((e) => e.type === "run_activated")).toBe(
      true
    )
    engine.close()
  })

  it("cancels a queued run without a scheduler and allows delete", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "cq",
      `
id: cq
tasks:
  - id: a
    kind: command
    run: "sleep 5 && echo ok"
`
    )
    const engine = createEngine({ home })
    const live = await engine.startRun({ workflowDir: wf, runId: "live" })
    const queued = await engine.startRun({ workflowDir: wf, runId: "wait" })
    expect(queued.status).toBe("queued")
    engine.cancelRun("wait")
    expect(engine.fold("wait")?.status).toBe("cancelled")
    engine.deleteRun("wait")
    expect(engine.fold("wait")?.deleted).toBe(true)
    engine.cancelRun("live")
    await live.wait()
    expect(engine.fold("live")?.status).toBe("cancelled")
    // Let cancel watchers finish before closing the event log.
    await new Promise((r) => setTimeout(r, 50))
    engine.close()
  }, 15_000)

  it("allows two running runs when maxConcurrentRuns is 2", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "cap2",
      `
id: cap2
limits:
  maxConcurrentRuns: 2
tasks:
  - id: a
    kind: command
    run: "sleep 0.2 && echo ok"
`
    )
    const engine = createEngine({ home })
    const a = await engine.startRun({ workflowDir: wf, runId: "a" })
    const b = await engine.startRun({ workflowDir: wf, runId: "b" })
    expect(a.status).toBe("running")
    expect(b.status).toBe("running")
    await Promise.all([a.wait(), b.wait()])
    engine.close()
  })

  it("resumeAll activates a queued run after replay", async () => {
    const home = tempHome()
    const wf = writeWorkflow(
      home,
      "resq",
      `
id: resq
tasks:
  - id: a
    kind: command
    run: "sleep 8 && echo ok"
`
    )
    const engine = createEngine({ home })
    await engine.startRun({ workflowDir: wf, runId: "live" })
    expect(
      (await engine.startRun({ workflowDir: wf, runId: "wait" })).status
    ).toBe("queued")
    await new Promise((r) => setTimeout(r, 50))
    engine.close()

    const again = createEngine({ home })
    expect(again.fold("wait")?.status).toBe("queued")
    again.resumeAll()
    expect(again.fold("live")?.status).toBe("running")
    expect(again.fold("wait")?.status).toBe("queued")
    again.cancelRun("live")
    await again.resumeRun("live")!.wait()
    const waitHandle = again.resumeRun("wait")
    if (waitHandle) await waitHandle.wait()
    expect(again.fold("wait")?.status).toBe("succeeded")
    expect(again.events("wait").some((e) => e.type === "run_activated")).toBe(
      true
    )
    await new Promise((r) => setTimeout(r, 50))
    again.close()
  }, 20_000)
})

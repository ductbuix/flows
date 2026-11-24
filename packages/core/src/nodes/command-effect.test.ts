import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createFakeEventStore } from "../testing/fake-event-store.ts"
import { createFakeProcessRunner } from "../testing/fake-process-runner.ts"
import { RunActor } from "../runs/actor.ts"
import { at, parse } from "../runs/decide-harness.ts"
import { latestStep } from "../runs/model.ts"
import { createNodeEffectRunner } from "./run.ts"

describe("command effect on RunActor", () => {
  it("runs a command node via ProcessRunner and succeeds", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    docs.write(`${runDir}/input/text.md`, "hello")
    const runner = createFakeProcessRunner()
    runner.on("/bin/sh", (spec) => {
      expect(spec.args).toEqual(["-c", "printf out"])
      expect(spec.env?.NODE_OUT).toContain("attempt-1/out")
      return { stdout: "out", exitCode: 0 }
    })

    const events = createFakeEventStore()
    const actor = new RunActor("r1", {
      events,
      runEffect: createNodeEffectRunner({
        docs,
        process: runner,
        runDirOf: () => runDir,
        workflowDirOf: () => "workflows/wf",
        absolutePathOf: (p) => `/abs/${p.replace(/^\//, "")}`,
      }),
    })

    const graph = parse(
      [{ id: "a", kind: "command", run: "printf out" }],
      [{ from: "t", to: "a" }]
    )
    await actor.push({ kind: "start", at, runId: "r1", graph })

    expect(actor.getState()?.status).toBe("succeeded")
    expect(latestStep(actor.getState()!.steps, "a")).toMatchObject({
      status: "done",
    })
    expect(docs.read(`${runDir}/nodes/a/pass-1/text.md`)?.text).toBe("out")
    const types = events.read("r1").map((s) => s.event.type)
    expect(types).toContain("run_started")
    expect(types).toContain("step_done")
    expect(types).toContain("run_succeeded")
  })

  it("fails the step when the process exits non-zero", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    docs.write(`${runDir}/input/text.md`, "")
    const runner = createFakeProcessRunner()
    runner.on("/bin/sh", () => ({ exitCode: 1, stderr: "boom" }))

    const actor = new RunActor("r1", {
      events: createFakeEventStore(),
      runEffect: createNodeEffectRunner({
        docs,
        process: runner,
        runDirOf: () => runDir,
        workflowDirOf: () => "workflows/wf",
      }),
    })
    const graph = parse(
      [{ id: "a", kind: "command", run: "false" }],
      [{ from: "t", to: "a" }]
    )
    await actor.push({ kind: "start", at, runId: "r1", graph })
    expect(actor.getState()?.status).toBe("failed")
    expect(latestStep(actor.getState()!.steps, "a")?.status).toBe("failed")
  })
})

import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createFakeEventStore } from "../testing/fake-event-store.ts"
import { RunActor } from "../runs/actor.ts"
import { at, parse } from "../runs/decide-harness.ts"
import { latestStep } from "../runs/model.ts"
import { createStepContext } from "./context.ts"
import { approvalKind } from "./kinds/approval.ts"
import { collectExecute, createNodeEffectRunner } from "./run.ts"

describe("approval kind", () => {
  it("asks via inbox.ask and parks when unanswered", async () => {
    const docs = createFakeDocumentStore()
    const ctx = createStepContext({
      docs,
      runDir: "runs/r1",
      nodeId: "ok",
      pass: 1,
      settings: { question: "Ship {{what}}?" },
      inputs: [],
      answers: { what: "it" },
      graph: { id: "wf" },
    })
    await expect(collectExecute(approvalKind.execute(ctx))).resolves.toEqual({
      waiting: true,
      question: "Ship it?",
    })
  })

  it("copies nothing on approve", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "runs/r1"
    docs.write(`${runDir}/nodes/t/pass-1/text.md`, "the change")
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "ok",
      pass: 1,
      settings: { question: "Ship it?" },
      inputs: [
        {
          from: "t",
          path: `${runDir}/nodes/t/pass-1/text.md`,
          name: "text.md",
          text: "the change",
        },
      ],
      decision: "approved",
      graph: { id: "wf" },
    })
    const result = await collectExecute(approvalKind.execute(ctx))
    expect(result).toEqual({ ok: true, outputs: [] })
    expect(docs.read(`${runDir}/nodes/ok/pass-1/text.md`)).toBeNull()
  })

  it("runs on the actor: wait, approve, then pass results on", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    docs.write(`${runDir}/input/text.md`, "payload")
    const events = createFakeEventStore()
    const notices: { title: string; text: string }[] = []
    const actor = new RunActor("r1", {
      events,
      runEffect: createNodeEffectRunner({
        docs,
        runDirOf: () => runDir,
        postNotice: (n) => notices.push(n),
      }),
    })
    const graph = parse(
      [
        { id: "ok", kind: "approval", question: "Ship it?" },
        { id: "out", kind: "output", target: "folder" },
      ],
      [
        { from: "t", to: "ok" },
        { from: "ok", to: "out" },
      ]
    )
    await actor.push({ kind: "start", at, runId: "r1", graph })
    expect(latestStep(actor.getState()!.steps, "ok")).toMatchObject({
      status: "waiting",
      question: "Ship it?",
    })
    expect(
      events.read("r1").filter((e) => e.event.type === "approval_requested")
    ).toHaveLength(1)

    await actor.push({
      kind: "answer",
      at,
      nodeId: "ok",
      pass: 1,
      decision: "approved",
    })
    await actor.push({ kind: "wake", at })
    expect(latestStep(actor.getState()!.steps, "ok")).toMatchObject({
      status: "done",
      decision: "approved",
    })
    expect(actor.getState()?.status).toBe("succeeded")
    // The output reads the trigger's result through the gate.
    expect(docs.read(`${runDir}/output/t/text.md`)?.text).toBe("payload")
    expect(docs.read(`${runDir}/output/ok/text.md`)).toBeNull()
    expect(notices).toEqual([])
  })
})

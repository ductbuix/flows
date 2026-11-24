import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createFakeEventStore } from "../testing/fake-event-store.ts"
import { RunActor } from "../runs/actor.ts"
import { at, parse } from "../runs/decide-harness.ts"
import { latestStep } from "../runs/model.ts"
import { createStepContext } from "./context.ts"
import { notifyKind } from "./kinds/notify.ts"
import {
  collectExecute,
  createNodeEffectRunner,
  type NoticePost,
} from "./run.ts"

describe("notify kind", () => {
  it("yields a notice with title and joined input text", async () => {
    const docs = createFakeDocumentStore()
    const ctx = createStepContext({
      docs,
      runDir: "runs/r1",
      nodeId: "n",
      pass: 1,
      settings: { target: "notify" as const, title: "Report ready" },
      inputs: [
        {
          from: "t",
          path: "runs/r1/nodes/t/pass-1/text.md",
          name: "text.md",
          text: "all green",
        },
      ],
      graph: { id: "wf", name: "Nightly" },
    })
    const result = await collectExecute(notifyKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: [],
      notice: {
        title: "Report ready",
        text: expect.stringContaining("all green") as string,
      },
    })
  })

  it("carries channel system for a system notification", async () => {
    const ctx = createStepContext({
      docs: createFakeDocumentStore(),
      runDir: "runs/r1",
      nodeId: "n",
      pass: 1,
      settings: {
        target: "notify" as const,
        title: "Shipped",
        channel: "system" as const,
      },
      inputs: [],
      graph: { id: "wf" },
    })
    const result = await collectExecute(notifyKind.execute(ctx))
    expect(result).toMatchObject({
      notice: { title: "Shipped", channel: "system" },
    })
  })

  it("falls back to the workflow name for the title", async () => {
    const docs = createFakeDocumentStore()
    const ctx = createStepContext({
      docs,
      runDir: "runs/r1",
      nodeId: "n",
      pass: 1,
      settings: { target: "notify" as const },
      inputs: [],
      graph: { id: "wf", name: "Nightly" },
    })
    const result = await collectExecute(notifyKind.execute(ctx))
    expect(result).toMatchObject({
      ok: true,
      notice: { title: "Nightly", text: "" },
    })
  })

  it("runs on the actor and posts one notice", async () => {
    const docs = createFakeDocumentStore()
    const runDir = "workflows/wf/runs/r1"
    docs.write(`${runDir}/input/text.md`, "all green")
    const events = createFakeEventStore()
    const notices: NoticePost[] = []
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
        {
          id: "n",
          kind: "output",
          target: "notify",
          title: "Report ready",
          channel: "system",
        },
      ],
      [{ from: "t", to: "n" }]
    )
    await actor.push({ kind: "start", at, runId: "r1", graph })
    expect(latestStep(actor.getState()!.steps, "n")?.status).toBe("done")
    expect(actor.getState()?.status).toBe("succeeded")
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      key: "r1:n:1",
      title: "Report ready",
      channel: "system",
    })
    expect(notices[0]!.text).toContain("all green")
  })
})

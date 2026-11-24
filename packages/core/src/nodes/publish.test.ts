import { describe, expect, it } from "vitest"
import type { ChangeSet } from "@workspace/contracts"
import type { PublishPort } from "../ports/publish.ts"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createStepContext } from "./context.ts"
import { publishKind } from "./kinds/publish.ts"
import { collectExecute } from "./run.ts"

function changeSet(ops: ChangeSet["ops"]): ChangeSet {
  return { v: 1, connection: "demo", base: "b1", ops }
}

function fakePublish(opts: {
  policy?: "approve-each-publish" | "read-only" | null
  changeSet?: ChangeSet
  apply?: PublishPort["apply"]
}): PublishPort {
  return {
    policy: () => opts.policy ?? "approve-each-publish",
    diff: async () =>
      opts.changeSet ??
      changeSet([
        {
          op: "upsert",
          target: "x",
          summary: "edit",
          destructive: false,
          payload: {},
        },
      ]),
    apply:
      opts.apply ??
      (async () => ({
        status: "applied" as const,
        result: { ok: true },
        undoNote: "undo",
      })),
  }
}

describe("publish kind", () => {
  it("asks then applies after approval", async () => {
    const docs = createFakeDocumentStore()
    const port = fakePublish({})
    const waiting = await collectExecute(
      publishKind.execute(
        createStepContext({
          docs,
          runDir: "workflows/wf/runs/r1",
          runId: "r1",
          nodeId: "ship",
          pass: 1,
          settings: { target: "publish" as const, connection: "demo" },
          inputs: [],
          graph: { id: "wf" },
          publish: port,
        })
      )
    )
    expect(waiting).toEqual({
      waiting: true,
      question: "Publish 1 change to demo?",
    })

    const done = await collectExecute(
      publishKind.execute(
        createStepContext({
          docs,
          runDir: "workflows/wf/runs/r1",
          runId: "r1",
          nodeId: "ship",
          pass: 1,
          settings: { target: "publish" as const, connection: "demo" },
          inputs: [],
          graph: { id: "wf" },
          decision: "approved",
          publish: port,
        })
      )
    )
    expect(done).toMatchObject({ ok: true })
    expect(
      docs.read("workflows/wf/runs/r1/nodes/ship/pass-1/result.json")?.text
    ).toContain('"ok": true')
  })

  it("finishes immediately when the change set is empty", async () => {
    const docs = createFakeDocumentStore()
    const result = await collectExecute(
      publishKind.execute(
        createStepContext({
          docs,
          runDir: "runs/r1",
          nodeId: "ship",
          pass: 1,
          settings: { target: "publish" as const, connection: "demo" },
          inputs: [],
          graph: { id: "wf" },
          publish: fakePublish({ changeSet: changeSet([]) }),
        })
      )
    )
    expect(result).toEqual({ ok: true, outputs: [] })
  })
})

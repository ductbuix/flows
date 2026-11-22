import { randomUUID } from "node:crypto"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEngine, runDir } from "@workspace/engine"
import {
  inputsJsonSchema,
  runSummarySchema,
  startRunResponseSchema,
  unknownWorkItemErrorSchema,
  workItemDetailSchema,
} from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"
import { settle } from "./test-utils.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function stack(yaml: string, id = "wi-wf") {
  const home = mkdtempSync(join(tmpdir(), "flowapp-wi-run-api-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  const dir = join(home, "workflows", id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml)
  return { home, engine, app, dir, id }
}

async function createItem(
  app: ReturnType<typeof createApp>,
  title: string
): Promise<string> {
  const res = await app.request("/api/workitems", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  })
  expect(res.status).toBe(201)
  return workItemDetailSchema.parse(await res.json()).item.id
}

const WF = `
id: wi-wf
limits:
  maxConcurrentRuns: 2
nodes:
  - id: t
    kind: trigger
    type: manual
    inputs:
      - name: ticket
        type: text
        required: true
  - id: a
    kind: command
    run: echo ok
edges:
  - { from: t, to: a }
`

describe("start/rerun with workItemId", () => {
  it("returns 400 unknown_work_item for a missing id", async () => {
    const { engine, app } = stack(WF)
    const res = await app.request("/api/workflows/wi-wf/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: randomUUID(),
        values: { ticket: "T-1" },
        workItemId: "missing-item",
      }),
    })
    expect(res.status).toBe(400)
    expect(unknownWorkItemErrorSchema.parse(await res.json())).toEqual({
      error: "unknown_work_item",
      workItemId: "missing-item",
    })
    engine.close()
  })

  it("starts with workItemId and filters GET /runs", async () => {
    const { engine, app, dir } = stack(WF)
    const workItemId = await createItem(app, "Filter me")

    const started = startRunResponseSchema.parse(
      await (
        await app.request("/api/workflows/wi-wf/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestId: randomUUID(),
            values: { ticket: "T-1" },
            workItemId,
          }),
        })
      ).json()
    )
    await settle(engine, started.runId)

    const state = engine.fold(started.runId)
    expect(state?.workItemId).toBe(workItemId)

    const meta = inputsJsonSchema.parse(
      JSON.parse(
        readFileSync(
          join(runDir(dir, started.runId), "input", "inputs.json"),
          "utf8"
        )
      )
    )
    expect(meta.workItemId).toBe(workItemId)

    const filtered = runSummarySchema
      .array()
      .parse(
        await (await app.request(`/api/runs?workItemId=${workItemId}`)).json()
      )
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.id).toBe(started.runId)
    expect(filtered[0]?.workItemId).toBe(workItemId)

    const empty = runSummarySchema
      .array()
      .parse(await (await app.request("/api/runs?workItemId=other-id")).json())
    expect(empty).toEqual([])
    engine.close()
  }, 20_000)

  it("rerun keeps the original workItemId", async () => {
    const { engine, app } = stack(WF)
    const workItemId = await createItem(app, "Rerun me")

    const first = startRunResponseSchema.parse(
      await (
        await app.request("/api/workflows/wi-wf/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestId: randomUUID(),
            values: { ticket: "T-1" },
            workItemId,
          }),
        })
      ).json()
    )
    await settle(engine, first.runId)

    const rerunRes = await app.request(`/api/runs/${first.runId}/rerun`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: randomUUID(),
        values: { ticket: "T-1" },
      }),
    })
    expect(rerunRes.status).toBe(200)
    const second = startRunResponseSchema.parse(await rerunRes.json())
    await settle(engine, second.runId)

    expect(engine.fold(second.runId)?.workItemId).toBe(workItemId)
    engine.close()
  }, 20_000)
})

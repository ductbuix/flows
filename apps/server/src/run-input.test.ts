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
  duplicateInputErrorSchema,
  invalidInputErrorSchema,
  startRunResponseSchema,
} from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function stack(yaml: string, id = "in-wf") {
  const home = mkdtempSync(join(tmpdir(), "flowapp-srv-in-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  const dir = join(home, "workflows", id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml)
  return { home, engine, app, dir, id }
}

describe("start run inputs API", () => {
  it("returns 400 invalid_input for a missing required field", async () => {
    const { engine, app } = stack(`
id: in-wf
inputs:
  - name: ticket
    type: text
    required: true
tasks:
  - id: a
    kind: command
    run: echo ok
`)
    const res = await app.request("/api/workflows/in-wf/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID(), values: {} }),
    })
    expect(res.status).toBe(400)
    const body = invalidInputErrorSchema.parse(await res.json())
    expect(body.fields.ticket).toBeTruthy()
    engine.close()
  })

  it("returns 409 duplicate_input unless confirmDuplicate", async () => {
    const { engine, app } = stack(`
id: in-wf
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
`)
    const start = (confirm?: boolean) =>
      app.request("/api/workflows/in-wf/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: randomUUID(),
          values: { ticket: "T-1" },
          confirmDuplicate: confirm,
        }),
      })

    const first = startRunResponseSchema.parse(await (await start()).json())
    await engine.resumeRun(first.runId)!.wait()

    const dupRes = await start()
    expect(dupRes.status).toBe(409)
    const dup = duplicateInputErrorSchema.parse(await dupRes.json())
    expect(dup.itemKey).toBeTruthy()
    expect(dup.existingRunIds).toContain(first.runId)

    const second = startRunResponseSchema.parse(
      await (await start(true)).json()
    )
    expect(second.runId).not.toBe(first.runId)
    await engine.resumeRun(second.runId)!.wait()
    engine.close()
  }, 20_000)

  it("queues a second start and returns status queued", async () => {
    const { engine, app, dir } = stack(`
id: in-wf
tasks:
  - id: a
    kind: command
    run: "sleep 0.4 && echo ok"
`)
    const start = () =>
      app.request("/api/workflows/in-wf/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: randomUUID() }),
      })

    const first = startRunResponseSchema.parse(await (await start()).json())
    expect(first.status).toBe("running")
    const second = startRunResponseSchema.parse(await (await start()).json())
    expect(second.status).toBe("queued")

    const cancelRes = await app.request(`/api/runs/${second.runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID() }),
    })
    expect(cancelRes.status).toBe(200)
    expect(engine.fold(second.runId)?.status).toBe("cancelled")

    await engine.resumeRun(first.runId)!.wait()
    expect(
      readFileSync(
        join(runDir(dir, first.runId), "input", "inputs.json"),
        "utf8"
      )
    ).toContain("manual")
    engine.close()
  }, 20_000)
})

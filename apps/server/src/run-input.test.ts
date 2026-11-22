import { randomUUID } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEngine, runDir } from "@workspace/engine"
import {
  inputsJsonSchema,
  invalidInputErrorSchema,
  outListSchema,
  runDetailSchema,
  runInputFileDetailSchema,
  startRunResponseSchema,
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

  it("queues a second start and returns status queued", async () => {
    const { engine, app, dir } = stack(`
id: in-wf
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "sleep 0.4 && echo ok"
edges:
  - { from: t, to: a }
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

    await settle(engine, first.runId)
    expect(existsSync(join(runDir(dir, first.runId), "input"))).toBe(true)
    engine.close()
  }, 20_000)

  it("exposes run input files on detail and GET routes", async () => {
    const { engine, app } = stack(`
id: in-wf
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
`)
    const started = startRunResponseSchema.parse(
      await (
        await app.request("/api/workflows/in-wf/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestId: randomUUID(),
            values: { ticket: "ABC-1" },
          }),
        })
      ).json()
    )
    await settle(engine, started.runId)

    const detailRes = await app.request(`/api/runs/${started.runId}`)
    expect(detailRes.status).toBe(200)
    const detail = runDetailSchema.parse(await detailRes.json())
    expect(detail.status).toBe("succeeded")

    const listRes = await app.request(`/api/runs/${started.runId}/input`)
    expect(listRes.status).toBe(200)
    const listed = outListSchema.parse(await listRes.json())
    expect(listed.files.some((f) => f.path === "ticket.txt")).toBe(true)

    const metaRes = await app.request(`/api/runs/${started.runId}/input/meta`)
    expect(metaRes.status).toBe(200)
    const meta = inputsJsonSchema.parse(await metaRes.json())
    expect(meta.fields.ticket).toEqual({ type: "text", value: "ABC-1" })

    const fileRes = await app.request(
      `/api/runs/${started.runId}/input/files/ticket.txt`
    )
    expect(fileRes.status).toBe(200)
    const file = runInputFileDetailSchema.parse(await fileRes.json())
    expect(file.content).toBe("ABC-1")

    const dl = await app.request(
      `/api/runs/${started.runId}/input/files/ticket.txt?download=1`
    )
    expect(dl.status).toBe(200)
    expect(await dl.text()).toBe("ABC-1")
    engine.close()
  }, 20_000)
})

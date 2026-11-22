import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEngine, workflowDir } from "@workspace/engine"
import { noticeListSchema } from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

const yaml = `id: nt
nodes:
  - id: t
    kind: trigger
    type: manual
  - id: o
    kind: output
    target: notify
    title: Build done
edges:
  - { from: t, to: o }
`

const homes: string[] = []
afterEach(() => {
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

async function until(fn: () => boolean, ms = 8000) {
  const end = Date.now() + ms
  while (!fn()) {
    if (Date.now() > end) throw new Error("timeout")
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe("notices", () => {
  it("lists a notify notice and marks it read", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-notices-"))
    homes.push(home)
    const engine = createEngine({ home })
    const app = createApp({ engine })
    const dir = workflowDir(home, "nt")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), yaml)

    const empty = noticeListSchema.parse(
      await (await app.request("/api/notices")).json()
    )
    expect(empty).toEqual({ notices: [], unread: 0 })

    const res = await app.request(
      "/api/workflows/nt/runs",
      json({ requestId: crypto.randomUUID(), values: { text: "ship it" } })
    )
    expect(res.status).toBe(200)
    const { runId } = (await res.json()) as { runId: string }
    await until(() =>
      engine.events(runId).some((e) => e.type === "run_succeeded")
    )

    const list = noticeListSchema.parse(
      await (await app.request("/api/notices")).json()
    )
    expect(list.unread).toBe(1)
    expect(list.notices[0]).toMatchObject({
      title: "Build done",
      workflowId: "nt",
      runId,
      read: false,
    })
    expect(list.notices[0]!.text).toContain("ship it")

    const read = await app.request(
      "/api/notices/read",
      json({ ids: [list.notices[0]!.id] })
    )
    expect(read.status).toBe(200)
    expect(noticeListSchema.parse(await read.json())).toMatchObject({
      unread: 0,
    })
    const bad = await app.request("/api/notices/read", json({ ids: [0] }))
    expect(bad.status).toBe(400)
  })
})

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { createEngine } from "@workspace/engine"
import {
  workItemAttachmentListSchema,
  workItemDetailSchema,
  workItemNotesSchema,
  workItemSummarySchema,
} from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function stack() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-wi-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  return { home, engine, app }
}

describe("work items API", () => {
  it("creates, lists and reads a work item", async () => {
    const { home, engine, app } = stack()

    const createRes = await app.request("/api/workitems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Fix login bug",
        workflowId: "demo",
        inputs: { ticket: "ABC-1" },
        notes: "repro steps",
      }),
    })
    expect(createRes.status).toBe(201)
    const created = workItemDetailSchema.parse(await createRes.json())
    expect(created.item.id).toBe("fix-login-bug")
    expect(created.item.source).toEqual({ kind: "adhoc" })
    expect(created.item.inputs).toEqual({ ticket: "ABC-1" })
    expect(created.item.links).toEqual([])
    expect(created.hash).toMatch(/^[a-f0-9]{64}$/)

    expect(
      existsSync(join(home, "workitems", "fix-login-bug", "workitem.yaml"))
    ).toBe(true)
    expect(
      existsSync(join(home, "workitems", "fix-login-bug", "attachments"))
    ).toBe(true)
    expect(
      readFileSync(join(home, "workitems", "fix-login-bug", "notes.md"), "utf8")
    ).toBe("repro steps")

    const listRes = await app.request("/api/workitems")
    expect(listRes.status).toBe(200)
    const list = workItemSummarySchema.array().parse(await listRes.json())
    expect(list).toEqual([
      {
        id: "fix-login-bug",
        title: "Fix login bug",
        source: { kind: "adhoc" },
        workflowId: "demo",
        updatedAt: created.item.updatedAt,
      },
    ])

    const getRes = await app.request("/api/workitems/fix-login-bug")
    expect(getRes.status).toBe(200)
    expect(workItemDetailSchema.parse(await getRes.json())).toEqual(created)
    engine.close()
  })

  it("returns 409 on stale hash update", async () => {
    const { engine, app } = stack()
    const createRes = await app.request("/api/workitems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Stale check" }),
    })
    const created = workItemDetailSchema.parse(await createRes.json())

    const okRes = await app.request(`/api/workitems/${created.item.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Updated",
        inputs: {},
        baseHash: created.hash,
      }),
    })
    expect(okRes.status).toBe(200)
    const updated = workItemDetailSchema.parse(await okRes.json())
    expect(updated.item.title).toBe("Updated")

    const staleRes = await app.request(`/api/workitems/${created.item.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Nope",
        inputs: {},
        baseHash: created.hash,
      }),
    })
    expect(staleRes.status).toBe(409)
    const conflict = (await staleRes.json()) as {
      message: string
      diskHash: string
    }
    expect(conflict.message).toBe("conflict")
    expect(conflict.diskHash).toBe(updated.hash)
    engine.close()
  })

  it("reads and writes notes with hash conflict", async () => {
    const { engine, app } = stack()
    const createRes = await app.request("/api/workitems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Notes item", notes: "v1" }),
    })
    const created = workItemDetailSchema.parse(await createRes.json())

    const getRes = await app.request(`/api/workitems/${created.item.id}/notes`)
    expect(getRes.status).toBe(200)
    const notes = workItemNotesSchema.parse(await getRes.json())
    expect(notes.content).toBe("v1")

    const putRes = await app.request(
      `/api/workitems/${created.item.id}/notes`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "v2", baseHash: notes.hash }),
      }
    )
    expect(putRes.status).toBe(200)
    const next = workItemNotesSchema.parse(await putRes.json())
    expect(next.content).toBe("v2")

    const stale = await app.request(`/api/workitems/${created.item.id}/notes`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "v3", baseHash: notes.hash }),
    })
    expect(stale.status).toBe(409)
    engine.close()
  })

  it("uploads, lists and deletes attachments; rejects path traversal", async () => {
    const { home, engine, app } = stack()
    const createRes = await app.request("/api/workitems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Attach me" }),
    })
    const created = workItemDetailSchema.parse(await createRes.json())
    const id = created.item.id

    const form = new FormData()
    form.append(
      "file",
      new File([Buffer.from("hello")], "brief.txt", { type: "text/plain" })
    )
    const up = await app.request(`/api/workitems/${id}/attachments`, {
      method: "POST",
      body: form,
    })
    expect(up.status).toBe(201)
    expect(await up.json()).toEqual({ name: "brief.txt", size: 5 })
    expect(
      readFileSync(
        join(home, "workitems", id, "attachments", "brief.txt"),
        "utf8"
      )
    ).toBe("hello")

    const list = await app.request(`/api/workitems/${id}/attachments`)
    expect(list.status).toBe(200)
    expect(workItemAttachmentListSchema.parse(await list.json())).toEqual({
      files: [{ name: "brief.txt", size: 5 }],
    })

    const badForm = new FormData()
    badForm.append(
      "file",
      new File([Buffer.from("x")], "../escape.txt", { type: "text/plain" })
    )
    const bad = await app.request(`/api/workitems/${id}/attachments`, {
      method: "POST",
      body: badForm,
    })
    expect(bad.status).toBe(400)

    const badDel = await app.request(
      `/api/workitems/${id}/attachments/${encodeURIComponent("../escape.txt")}`,
      { method: "DELETE" }
    )
    expect(badDel.status).toBe(400)

    const del = await app.request(
      `/api/workitems/${id}/attachments/brief.txt`,
      { method: "DELETE" }
    )
    expect(del.status).toBe(204)
    expect(
      existsSync(join(home, "workitems", id, "attachments", "brief.txt"))
    ).toBe(false)
    engine.close()
  })

  it("delete moves to .trash and leaves runs alone", async () => {
    const { home, engine, app } = stack()
    const wfDir = join(home, "workflows", "demo")
    mkdirSync(wfDir, { recursive: true })
    writeFileSync(
      join(wfDir, "workflow.yaml"),
      `id: demo
goal: keep
tasks:
  - id: start
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
`
    )
    const startRes = await app.request("/api/workflows/demo/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID() }),
    })
    expect(startRes.status).toBe(200)
    const { runId } = (await startRes.json()) as { runId: string }
    await engine.resumeRun(runId)?.wait()

    const createRes = await app.request("/api/workitems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Trash me", workflowId: "demo" }),
    })
    const created = workItemDetailSchema.parse(await createRes.json())
    const id = created.item.id

    const del = await app.request(`/api/workitems/${id}`, { method: "DELETE" })
    expect(del.status).toBe(204)
    expect(existsSync(join(home, "workitems", id))).toBe(false)
    const trashRoot = join(home, "workitems", ".trash")
    const trashEntries = existsSync(trashRoot) ? readdirSync(trashRoot) : []
    expect(trashEntries.some((n) => n.startsWith(`${id}-`))).toBe(true)
    expect(existsSync(join(home, "workflows", "demo", "runs", runId))).toBe(
      true
    )
    engine.close()
  }, 30_000)
})

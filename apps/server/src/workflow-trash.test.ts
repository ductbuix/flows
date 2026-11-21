import { randomUUID } from "node:crypto"
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
import { createEngine } from "@workspace/engine"
import {
  removeTask,
  taskInLiveRunErrorSchema,
  workflowDetailSchema,
} from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

const baseYaml = `id: trash-wf
goal: trash tests
tasks:
  - id: keep
    kind: command
    run: echo keep
  - id: gone
    kind: command
    run: echo gone
    needs: [keep]
`

function stack(yaml = baseYaml) {
  const home = mkdtempSync(join(tmpdir(), "flowapp-wf-trash-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  const dir = join(home, "workflows", "trash-wf")
  mkdirSync(join(dir, "tasks", "gone"), { recursive: true })
  mkdirSync(join(dir, "tasks", "keep"), { recursive: true })
  writeFileSync(join(dir, "tasks", "gone", "prompt.md"), "remove me")
  writeFileSync(join(dir, "tasks", "keep", "need-gone.md"), "judge")
  writeFileSync(join(dir, "workflow.yaml"), yaml)
  return { home, engine, app, dir }
}

async function putYaml(
  app: ReturnType<typeof createApp>,
  yaml: string,
  baseHash: string
) {
  return app.request("/api/workflows/trash-wf", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ yaml, baseHash }),
  })
}

describe("workflow PUT task trash", () => {
  it("moves removed task folders and leftover need files", async () => {
    const { engine, app, dir } = stack()
    const getRes = await app.request("/api/workflows/trash-wf")
    const detail = workflowDetailSchema.parse(await getRes.json())
    const next = removeTask(detail.yaml, "gone")

    const putRes = await putYaml(app, next, detail.hash)
    expect(putRes.status).toBe(200)
    expect(existsSync(join(dir, "tasks", "gone"))).toBe(false)
    expect(existsSync(join(dir, "tasks", "keep", "need-gone.md"))).toBe(false)

    const trash = join(dir, "tasks", ".trash")
    const entries = readdirSync(trash)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatch(/^gone-\d{8}T\d{6}Z$/)
    const dest = join(trash, entries[0]!)
    expect(existsSync(join(dest, "prompt.md"))).toBe(true)
    expect(existsSync(join(dest, "from", "keep", "need-gone.md"))).toBe(true)
    engine.close()
  })

  it("skips a missing folder", async () => {
    const { engine, app, dir } = stack()
    rmSync(join(dir, "tasks", "gone"), { recursive: true, force: true })
    const getRes = await app.request("/api/workflows/trash-wf")
    const detail = workflowDetailSchema.parse(await getRes.json())
    const next = removeTask(detail.yaml, "gone")

    const putRes = await putYaml(app, next, detail.hash)
    expect(putRes.status).toBe(200)
    const entries = readdirSync(join(dir, "tasks", ".trash"))
    expect(entries).toHaveLength(1)
    expect(
      existsSync(
        join(
          dir,
          "tasks",
          ".trash",
          entries[0]!,
          "from",
          "keep",
          "need-gone.md"
        )
      )
    ).toBe(true)
    engine.close()
  })

  it("returns 409 task_in_live_run and writes nothing", async () => {
    const yaml = `id: trash-wf
goal: live
tasks:
  - id: keep
    kind: command
    run: "sleep 60"
  - id: gone
    kind: command
    run: echo gone
`
    const { engine, app, dir } = stack(yaml)
    const startRes = await app.request("/api/workflows/trash-wf/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID() }),
    })
    expect(startRes.status).toBe(200)
    const { runId } = (await startRes.json()) as { runId: string }
    const handle = engine.resumeRun(runId)
    expect(handle!.state().status).toBe("running")

    const getRes = await app.request("/api/workflows/trash-wf")
    const detail = workflowDetailSchema.parse(await getRes.json())
    const next = removeTask(detail.yaml, "gone")
    const before = readFileSync(join(dir, "workflow.yaml"), "utf8")

    const putRes = await putYaml(app, next, detail.hash)
    expect(putRes.status).toBe(409)
    const body = taskInLiveRunErrorSchema.parse(await putRes.json())
    expect(body.taskIds).toEqual(["gone"])
    expect(body.runIds).toEqual([runId])
    expect(readFileSync(join(dir, "workflow.yaml"), "utf8")).toBe(before)
    expect(existsSync(join(dir, "tasks", "gone"))).toBe(true)

    engine.cancelRun(runId)
    await handle!.wait()
    await new Promise((r) => setTimeout(r, 100))
    engine.close()
  }, 30_000)

  it("retries a leftover folder on the next save", async () => {
    const { engine, app, dir } = stack()
    const getRes = await app.request("/api/workflows/trash-wf")
    const detail = workflowDetailSchema.parse(await getRes.json())
    const next = removeTask(detail.yaml, "gone")

    // Pretend a prior save wrote yaml but left the folder behind.
    writeFileSync(join(dir, "workflow.yaml"), next)
    expect(existsSync(join(dir, "tasks", "gone"))).toBe(true)

    const again = await app.request("/api/workflows/trash-wf")
    const current = workflowDetailSchema.parse(await again.json())
    // Touch goal so the PUT is a real write with the same task set.
    const touched = current.yaml.replace("trash tests", "retry trash")
    const putRes = await putYaml(app, touched, current.hash)
    expect(putRes.status).toBe(200)
    expect(existsSync(join(dir, "tasks", "gone"))).toBe(false)
    const entries = readdirSync(join(dir, "tasks", ".trash"))
    expect(entries.some((e) => e.startsWith("gone-"))).toBe(true)
    engine.close()
  })

  it("returns 500 when the trash move fails after writing yaml", async () => {
    const { engine, app, dir } = stack()
    writeFileSync(join(dir, "tasks", ".trash"), "blocked")
    const getRes = await app.request("/api/workflows/trash-wf")
    const detail = workflowDetailSchema.parse(await getRes.json())
    const next = removeTask(detail.yaml, "gone")

    const putRes = await putYaml(app, next, detail.hash)
    expect(putRes.status).toBe(500)
    const body = (await putRes.json()) as { path?: string }
    expect(body.path).toMatch(/^tasks\/\.trash\/gone-/)
    expect(readFileSync(join(dir, "workflow.yaml"), "utf8")).toBe(next)
    engine.close()
  })
})

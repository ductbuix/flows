import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { createEngine } from "@workspace/engine"
import {
  memoryFileDetailSchema,
  memoryListSchema,
  renameWorkflowResponseSchema,
  workflowSummarySchema,
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
  const home = mkdtempSync(join(tmpdir(), "flowapp-life-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  return { home, engine, app }
}

describe("workflow lifecycle API", () => {
  it("creates, renames and deletes a workflow", async () => {
    const { home, engine, app } = stack()

    const createRes = await app.request("/api/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "alpha", goal: "first goal" }),
    })
    expect(createRes.status).toBe(201)
    expect(workflowSummarySchema.parse(await createRes.json())).toEqual({
      id: "alpha",
      goal: "first goal",
    })
    expect(existsSync(join(home, "workflows", "alpha", "memory"))).toBe(true)
    expect(existsSync(join(home, "workflows", "alpha", "input"))).toBe(true)
    expect(existsSync(join(home, "workflows", "alpha", "output"))).toBe(true)

    const startRes = await app.request("/api/workflows/alpha/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID() }),
    })
    expect(startRes.status).toBe(200)
    const { runId } = (await startRes.json()) as { runId: string }
    await engine.resumeRun(runId)?.wait()

    const renameRes = await app.request("/api/workflows/alpha/rename", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newId: "beta" }),
    })
    expect(renameRes.status).toBe(200)
    expect(renameWorkflowResponseSchema.parse(await renameRes.json())).toEqual({
      id: "beta",
    })
    expect(existsSync(join(home, "workflows", "alpha"))).toBe(false)
    expect(existsSync(join(home, "workflows", "beta", "workflow.yaml"))).toBe(
      true
    )
    const yaml = readFileSync(
      join(home, "workflows", "beta", "workflow.yaml"),
      "utf8"
    )
    expect(yaml).toMatch(/^id: beta$/m)
    const runs = await app.request("/api/workflows/beta/runs")
    expect(runs.status).toBe(200)
    const list = (await runs.json()) as Array<{ id: string }>
    expect(list.map((r) => r.id)).toContain(runId)

    const delRes = await app.request("/api/workflows/beta", {
      method: "DELETE",
    })
    expect(delRes.status).toBe(204)
    expect(existsSync(join(home, "workflows", "beta"))).toBe(false)
    engine.close()
  }, 30_000)

  it("returns 409 while a run is live", async () => {
    const { home, engine, app } = stack()
    const dir = join(home, "workflows", "slow")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      `id: slow
goal: block
tasks:
  - id: sleep
    kind: command
    run: "sleep 60"
`
    )

    const startRes = await app.request("/api/workflows/slow/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID() }),
    })
    expect(startRes.status).toBe(200)
    const { runId } = (await startRes.json()) as { runId: string }
    const handle = engine.resumeRun(runId)
    expect(handle).not.toBeNull()
    expect(handle!.state().status).toBe("running")

    const renameRes = await app.request("/api/workflows/slow/rename", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newId: "other" }),
    })
    expect(renameRes.status).toBe(409)

    const delRes = await app.request("/api/workflows/slow", {
      method: "DELETE",
    })
    expect(delRes.status).toBe(409)

    engine.cancelRun(runId)
    await handle!.wait()
    // Drain attempt-watch callbacks before closing the event log.
    await new Promise((r) => setTimeout(r, 100))
    engine.close()
  }, 30_000)
})

describe("memory files API", () => {
  it("lists, writes, renames and deletes memory files", async () => {
    const { home, engine, app } = stack()
    await app.request("/api/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "mem-wf", goal: "memory" }),
    })
    const yamlPath = join(home, "workflows", "mem-wf", "workflow.yaml")
    writeFileSync(
      yamlPath,
      `id: mem-wf
goal: memory
tasks:
  - id: plan
    kind: agent
    cli: claude
    memory: [memory/style.md]
`
    )

    const putRes = await app.request("/api/workflows/mem-wf/memory/style.md", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# style\n" }),
    })
    expect(putRes.status).toBe(200)
    const detail = memoryFileDetailSchema.parse(await putRes.json())
    expect(detail.content).toBe("# style\n")
    expect(detail.referencedBy).toEqual(["plan"])

    const listRes = await app.request("/api/workflows/mem-wf/memory")
    expect(memoryListSchema.parse(await listRes.json()).files).toHaveLength(1)

    const renameRes = await app.request(
      "/api/workflows/mem-wf/memory/style.md/rename",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newName: "voice.md",
          updateReferences: true,
        }),
      }
    )
    expect(renameRes.status).toBe(200)
    expect(
      existsSync(join(home, "workflows", "mem-wf", "memory", "style.md"))
    ).toBe(false)
    expect(readFileSync(yamlPath, "utf8")).toContain("memory/voice.md")

    const delRes = await app.request("/api/workflows/mem-wf/memory/voice.md", {
      method: "DELETE",
    })
    expect(delRes.status).toBe(200)
    expect(
      existsSync(join(home, "workflows", "mem-wf", "memory", "voice.md"))
    ).toBe(false)
    engine.close()
  })
})

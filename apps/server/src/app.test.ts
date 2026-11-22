import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEngine } from "@workspace/engine"
import { randomUUID } from "node:crypto"
import {
  healthSchema,
  logChunkSchema,
  okResponseSchema,
  runDetailSchema,
  runSummarySchema,
  startRunResponseSchema,
  summaryResponseSchema,
  workflowConflictSchema,
  workflowDetailSchema,
  workflowSummarySchema,
} from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"
import { existsSync } from "node:fs"
import { runDir, workflowDir } from "@workspace/engine"

const fixtureYaml = `id: api-diamond
goal: api test fixture
tasks:
  - id: a
    kind: command
    run: "printf 'HELLO_STDOUT\\n' && printf '# Title\\n' > \\"$(dirname \\"$TASK_OUT\\")/SUMMARY.md\\""
  - id: b
    kind: command
    run: "printf b > \\"$TASK_OUT/letter.txt\\""
    needs: [a]
  - id: c
    kind: command
    run: "printf c > \\"$TASK_OUT/letter.txt\\""
    needs: [a]
  - id: d
    kind: command
    run: "printf done > \\"$TASK_OUT/out.txt\\""
    needs: [b, c]
`

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function testStack() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-srv-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  const workflowDir = join(home, "workflows", "api-diamond")
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), fixtureYaml)
  return { home, engine, app, workflowDir }
}

describe("GET /api/health", () => {
  it("returns ok and a version", async () => {
    const { engine, app } = testStack()
    const res = await app.request("/api/health")
    expect(res.status).toBe(200)
    expect(healthSchema.parse(await res.json())).toEqual({
      ok: true,
      version: "0.0.1",
      nodes: false,
    })
    engine.close()
  })

  it("returns 404 for unknown routes", async () => {
    const { engine, app } = testStack()
    const res = await app.request("/api/nope")
    expect(res.status).toBe(404)
    engine.close()
  })
})

describe("run API", () => {
  it("lists workflows, starts a run, and returns run detail", async () => {
    const { engine, app } = testStack()

    const wfRes = await app.request("/api/workflows")
    expect(wfRes.status).toBe(200)
    const workflows = workflowSummarySchema.array().parse(await wfRes.json())
    expect(workflows).toEqual([
      { id: "api-diamond", goal: "api test fixture", taskCount: 4 },
    ])

    const startRes = await app.request("/api/workflows/api-diamond/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID() }),
    })
    expect(startRes.status).toBe(200)
    const { runId } = startRunResponseSchema.parse(await startRes.json())

    const handle = engine.resumeRun(runId)
    expect(handle).not.toBeNull()
    const state = await handle!.wait()
    expect(state.status).toBe("succeeded")

    const listRes = await app.request("/api/workflows/api-diamond/runs")
    const summaries = runSummarySchema.array().parse(await listRes.json())
    expect(summaries[0]?.id).toBe(runId)
    expect(summaries[0]?.status).toBe("succeeded")

    const detailRes = await app.request(`/api/runs/${runId}`)
    expect(detailRes.status).toBe(200)
    const detail = runDetailSchema.parse(await detailRes.json())
    expect(detail.workflowId).toBe("api-diamond")
    expect(detail.tasks.map((t) => t.id)).toEqual(["a", "b", "c", "d"])
    engine.close()
  }, 30_000)

  it("returns log text and SUMMARY.md for task a", async () => {
    const { engine, app } = testStack()

    const startRes = await app.request("/api/workflows/api-diamond/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID() }),
    })
    const { runId } = startRunResponseSchema.parse(await startRes.json())
    const handle = engine.resumeRun(runId)!
    await handle.wait()

    const logRes = await app.request(
      `/api/runs/${runId}/tasks/a/attempts/1/log?stream=stdout&offset=0`
    )
    expect(logRes.status).toBe(200)
    const chunk = logChunkSchema.parse(await logRes.json())
    expect(chunk.text).toContain("HELLO_STDOUT")

    const sumRes = await app.request(
      `/api/runs/${runId}/tasks/a/attempts/1/summary`
    )
    expect(sumRes.status).toBe(200)
    const summary = summaryResponseSchema.parse(await sumRes.json())
    expect(summary.missing).toBe(false)
    expect(summary.text).toContain("# Title")
    engine.close()
  }, 30_000)

  it("returns 404 for unknown runs", async () => {
    const { engine, app } = testStack()
    const res = await app.request("/api/runs/missing-run")
    expect(res.status).toBe(404)
    engine.close()
  })

  it("is idempotent on start and deletes a finished run", async () => {
    const { engine, app, home } = testStack()
    const requestId = randomUUID()
    const startOnce = () =>
      app.request("/api/workflows/api-diamond/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId }),
      })

    const first = startRunResponseSchema.parse(await (await startOnce()).json())
    const second = startRunResponseSchema.parse(
      await (await startOnce()).json()
    )
    expect(second.runId).toBe(first.runId)

    await engine.resumeRun(first.runId)!.wait()

    const delId = randomUUID()
    const delRes = await app.request(`/api/runs/${first.runId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: delId }),
    })
    expect(delRes.status).toBe(200)
    expect(okResponseSchema.parse(await delRes.json())).toEqual({ ok: true })
    expect(
      existsSync(runDir(workflowDir(home, "api-diamond"), first.runId))
    ).toBe(false)

    const listRes = await app.request("/api/workflows/api-diamond/runs")
    const summaries = runSummarySchema.array().parse(await listRes.json())
    expect(summaries.find((r) => r.id === first.runId)).toBeUndefined()
    engine.close()
  }, 30_000)
})

describe("workflow YAML API", () => {
  it("gets and puts workflow.yaml with hash conflict", async () => {
    const { engine, app, workflowDir } = testStack()

    const getRes = await app.request("/api/workflows/api-diamond")
    expect(getRes.status).toBe(200)
    const detail = workflowDetailSchema.parse(await getRes.json())
    expect(detail.workflow?.id).toBe("api-diamond")
    expect(detail.hash.length).toBe(64)

    const nextYaml = detail.yaml.replace(
      "goal: api test fixture",
      "goal: updated goal"
    )
    const putOk = await app.request("/api/workflows/api-diamond", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yaml: nextYaml, baseHash: detail.hash }),
    })
    expect(putOk.status).toBe(200)
    const saved = workflowDetailSchema.parse(await putOk.json())
    expect(saved.workflow?.goal).toBe("updated goal")
    expect(readFileSync(join(workflowDir, "workflow.yaml"), "utf8")).toContain(
      "updated goal"
    )

    writeFileSync(
      join(workflowDir, "workflow.yaml"),
      fixtureYaml.replace("api test fixture", "disk change")
    )
    const putConflict = await app.request("/api/workflows/api-diamond", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yaml: nextYaml, baseHash: saved.hash }),
    })
    expect(putConflict.status).toBe(409)
    const conflict = workflowConflictSchema.parse(await putConflict.json())
    expect(conflict.diskYaml).toContain("disk change")
    engine.close()
  })
})

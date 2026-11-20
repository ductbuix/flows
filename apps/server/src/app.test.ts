import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEngine } from "@workspace/engine"
import {
  healthSchema,
  logChunkSchema,
  runDetailSchema,
  runSummarySchema,
  startRunResponseSchema,
  summaryResponseSchema,
  workflowSummarySchema,
} from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

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
    expect(workflows).toEqual([{ id: "api-diamond", goal: "api test fixture" }])

    const startRes = await app.request("/api/workflows/api-diamond/runs", {
      method: "POST",
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
})

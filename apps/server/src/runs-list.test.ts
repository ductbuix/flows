import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { createEngine } from "@workspace/engine"
import {
  okResponseSchema,
  runSummarySchema,
  startRunResponseSchema,
  wsServerMessageSchema,
} from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function testStack() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-runs-list-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  return { home, engine, app }
}

function writeWorkflow(home: string, id: string, yaml: string): string {
  const workflowDir = join(home, "workflows", id)
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), yaml)
  return workflowDir
}

async function startRun(
  app: ReturnType<typeof createApp>,
  workflowId: string
): Promise<string> {
  const res = await app.request(`/api/workflows/${workflowId}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: randomUUID() }),
  })
  expect(res.status).toBe(200)
  return startRunResponseSchema.parse(await res.json()).runId
}

function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("timed out waiting"))
        return
      }
      setTimeout(tick, 25)
    }
    tick()
  })
}

describe("GET /api/runs", () => {
  it("filters by status and workflowId, newest first, default limit", async () => {
    const { home, engine, app } = testStack()
    writeWorkflow(
      home,
      "alpha",
      `
id: alpha
tasks:
  - id: a
    kind: command
    run: "printf a > \\"$TASK_OUT/out.txt\\""
`
    )
    writeWorkflow(
      home,
      "beta",
      `
id: beta
tasks:
  - id: a
    kind: command
    run: "printf b > \\"$TASK_OUT/out.txt\\""
`
    )

    const alphaId = await startRun(app, "alpha")
    await engine.resumeRun(alphaId)!.wait()
    const betaId = await startRun(app, "beta")
    await engine.resumeRun(betaId)!.wait()

    const allRes = await app.request("/api/runs")
    expect(allRes.status).toBe(200)
    const all = runSummarySchema.array().parse(await allRes.json())
    expect(all.map((r) => r.id)).toEqual([betaId, alphaId])
    expect(all[0]?.workflowName).toBe("beta")

    const byWf = runSummarySchema
      .array()
      .parse(await (await app.request("/api/runs?workflowId=alpha")).json())
    expect(byWf.map((r) => r.id)).toEqual([alphaId])

    const byStatus = runSummarySchema
      .array()
      .parse(await (await app.request("/api/runs?status=succeeded")).json())
    expect(byStatus).toHaveLength(2)

    const limited = runSummarySchema
      .array()
      .parse(await (await app.request("/api/runs?limit=1")).json())
    expect(limited).toHaveLength(1)
    expect(limited[0]?.id).toBe(betaId)

    engine.close()
  }, 30_000)

  it("omits deleted runs", async () => {
    const { home, engine, app } = testStack()
    writeWorkflow(
      home,
      "del",
      `
id: del
tasks:
  - id: a
    kind: command
    run: "printf x > \\"$TASK_OUT/out.txt\\""
`
    )
    const runId = await startRun(app, "del")
    await engine.resumeRun(runId)!.wait()

    const delRes = await app.request(`/api/runs/${runId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID() }),
    })
    expect(delRes.status).toBe(200)
    expect(okResponseSchema.parse(await delRes.json())).toEqual({ ok: true })

    const list = runSummarySchema
      .array()
      .parse(await (await app.request("/api/runs")).json())
    expect(list.find((r) => r.id === runId)).toBeUndefined()
    expect(engine.getRunSummary(runId)).toBeNull()
    engine.close()
  }, 20_000)

  it("exposes needsYou while awaiting approval", async () => {
    const { home, engine, app } = testStack()
    writeWorkflow(
      home,
      "gate",
      `
id: gate
tasks:
  - id: hold
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
    approval: true
`
    )
    const runId = await startRun(app, "gate")
    const handle = engine.resumeRun(runId)!
    await waitFor(
      () => handle.state().tasks.hold?.status === "awaiting_approval"
    )

    const list = runSummarySchema
      .array()
      .parse(await (await app.request("/api/runs")).json())
    const row = list.find((r) => r.id === runId)
    expect(row?.status).toBe("running")
    expect(row?.needsYou).toEqual([{ taskId: "hold" }])
    expect(row?.taskCounts).toEqual({ done: 0, total: 1 })

    engine.approveTask(runId, "hold")
    await handle.wait()
    engine.close()
  }, 20_000)

  it("sets firstFailedTaskId on a failed run", async () => {
    const { home, engine, app } = testStack()
    writeWorkflow(
      home,
      "boom",
      `
id: boom
tasks:
  - id: ok
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
  - id: fail
    kind: command
    run: "exit 1"
    needs: [ok]
`
    )
    const runId = await startRun(app, "boom")
    const state = await engine.resumeRun(runId)!.wait()
    expect(state.status).toBe("failed")

    const list = runSummarySchema
      .array()
      .parse(await (await app.request("/api/runs")).json())
    const row = list.find((r) => r.id === runId)
    expect(row?.status).toBe("failed")
    expect(row?.firstFailedTaskId).toBe("fail")
    expect(row?.taskCounts.done).toBeGreaterThanOrEqual(1)
    engine.close()
  }, 20_000)
})

describe("runs_changed schema", () => {
  it("accepts a summary payload and a null after delete", () => {
    const withSummary = wsServerMessageSchema.parse({
      type: "runs_changed",
      runId: "r1",
      summary: {
        id: "r1",
        workflowId: "w1",
        workflowName: "w1",
        status: "running",
        needsYou: [{ taskId: "hold" }],
        taskCounts: { done: 0, total: 1 },
        startedAt: "2026-01-01T00:00:00.000Z",
      },
    })
    expect(withSummary.type).toBe("runs_changed")
    if (withSummary.type === "runs_changed") {
      expect(withSummary.summary?.needsYou).toEqual([{ taskId: "hold" }])
    }

    const deleted = wsServerMessageSchema.parse({
      type: "runs_changed",
      runId: "r1",
      summary: null,
    })
    expect(deleted).toEqual({
      type: "runs_changed",
      runId: "r1",
      summary: null,
    })
  })
})

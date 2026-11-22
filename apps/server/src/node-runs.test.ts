import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEngine, runDir, workflowDir } from "@workspace/engine"
import {
  runDetailSchema,
  runSummarySchema,
  type WsServerMessage,
} from "@workspace/shared"
import type { WSContext } from "hono/ws"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"
import { WsHub } from "./ws-hub.ts"

const yaml = (cmd: string, extra = "") => `id: nr
${extra}nodes:
  - id: t
    kind: trigger
    type: manual
  - id: c
    kind: command
    run: ${JSON.stringify(cmd)}
  - id: o
    kind: output
    target: folder
edges:
  - { from: t, to: c }
  - { from: c, to: o }
`

const homes: string[] = []
beforeEach(() => {
  process.env.FLOWS_NODES = "1"
})
afterEach(() => {
  delete process.env.FLOWS_NODES
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

function stack(cmd = "echo hello", extra = "") {
  const home = mkdtempSync(join(tmpdir(), "flowapp-noderuns-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  const dir = workflowDir(home, "nr")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml(cmd, extra))
  writeFileSync(
    join(dir, "workflow.layout.json"),
    JSON.stringify({ version: 1, nodes: { t: { x: 1, y: 2 } } })
  )
  return { home, engine, app, dir }
}
type Stack = ReturnType<typeof stack>

const post = (app: Stack["app"], path: string, body: unknown = {}) =>
  app.request(`/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: crypto.randomUUID(), ...(body as object) }),
  })

async function start(s: Stack, body: unknown = {}) {
  const res = await post(s.app, "/workflows/nr/runs", body)
  expect(res.status).toBe(200)
  return (await res.json()) as { runId: string; status: string }
}

async function until(fn: () => boolean, ms = 8000) {
  const end = Date.now() + ms
  while (!fn()) {
    if (Date.now() > end) throw new Error("timeout")
    await new Promise((r) => setTimeout(r, 20))
  }
}

const types = (s: Stack, runId: string) =>
  s.engine.events(runId).map((e) => e.type)

describe("node runs behind FLOWS_NODES", () => {
  it("starts Trigger, Command, Output to run_succeeded and maps the fold", async () => {
    const s = stack()
    const { runId } = await start(s, { values: { text: "story" } })
    await until(() => types(s, runId).includes("run_succeeded"))

    const root = runDir(s.dir, runId)
    expect(JSON.parse(readFileSync(join(root, "graph.json"), "utf8")).id).toBe("nr")
    expect(JSON.parse(readFileSync(join(root, "layout.json"), "utf8")).nodes.t).toEqual({ x: 1, y: 2 })
    expect(readFileSync(join(root, "input", "text.md"), "utf8")).toBe("story")
    expect(existsSync(join(root, "output", "c", "text.md"))).toBe(true)

    const detail = runDetailSchema.parse(
      await (await s.app.request(`/api/runs/${runId}`)).json()
    )
    expect(detail.status).toBe("succeeded")
    expect(detail.tasks.map((t) => [t.id, t.status])).toEqual([
      ["t", "succeeded"],
      ["c", "succeeded"],
      ["o", "succeeded"],
    ])
    expect(detail.tasks[1]!.attempts[0]!.exitCode).toBe(0)

    const list = (await (await s.app.request("/api/runs")).json()) as unknown[]
    const row = runSummarySchema.parse(list[0])
    expect(row).toMatchObject({ id: runId, status: "succeeded", taskCounts: { done: 3, total: 3 } })
    const forWf = (await (await s.app.request("/api/workflows/nr/runs")).json()) as unknown[]
    expect(forWf).toHaveLength(1)

    const log = await s.app.request(
      `/api/runs/${runId}/tasks/c/attempts/1/log?stream=stdout`
    )
    expect(((await log.json()) as { text: string }).text).toBe("hello\n")
    s.engine.close()
  })

  it("answers preflight for a node workflow without checking tasks", async () => {
    const s = stack()
    const res = await post(s.app, "/workflows/nr/runs/preflight")
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ needsAgentCli: false, checks: [] })
    s.engine.close()
  })

  it("lists the CLIs of Agent nodes in the preflight", async () => {
    const s = stack()
    writeFileSync(
      join(s.dir, "workflow.yaml"),
      `id: nr
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: agent, cli: cursor }
  - { id: b, kind: agent, cli: claude }
  - { id: c, kind: agent, cli: claude }
edges:
  - { from: t, to: a }
`
    )
    const res = await post(s.app, "/workflows/nr/runs/preflight")
    expect(await res.json()).toMatchObject({
      needsAgentCli: true,
      clis: ["claude", "cursor"],
    })
    s.engine.close()
  })

  it("writes declared Trigger inputs to the run input and checks them", async () => {
    const s = stack(
      'cat "$RUN_INPUT/ticket.txt"',
      ""
    )
    writeFileSync(
      join(s.dir, "workflow.yaml"),
      yaml('cat "$RUN_INPUT/ticket.txt"').replace(
        "    type: manual\n",
        "    type: manual\n    inputs:\n      - { name: ticket, type: text, required: true }\n"
      )
    )
    const bad = await post(s.app, "/workflows/nr/runs", { values: {} })
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({
      error: "invalid_input",
      fields: { ticket: expect.any(String) },
    })

    const { runId } = await start(s, { values: { ticket: "T-9" } })
    await until(() => types(s, runId).includes("run_succeeded"))
    const input = join(runDir(s.dir, runId), "input")
    expect(readFileSync(join(input, "ticket.txt"), "utf8")).toBe("T-9")
    expect(
      JSON.parse(readFileSync(join(input, "inputs.json"), "utf8")).fields.ticket
    ).toEqual({ type: "text", value: "T-9" })
    s.engine.close()
  })

  it("cancels a run with a live process", async () => {
    const s = stack("sleep 30")
    const { runId } = await start(s)
    await until(() => s.engine.fold(runId)!.steps!.steps.c?.[0]?.current?.pid !== undefined)
    const pid = s.engine.fold(runId)!.steps!.steps.c![0]!.current!.pid!

    expect((await post(s.app, `/runs/${runId}/cancel`)).status).toBe(200)
    const state = s.engine.fold(runId)!
    expect(state.status).toBe("cancelled")
    expect(state.steps!.steps.c![0]!.status).toBe("cancelled")
    expect(types(s, runId)).toContain("cancel_requested")
    await until(() => {
      try {
        process.kill(pid, 0)
        return false
      } catch {
        return true
      }
    })
    // cancelling again is a conflict
    expect((await post(s.app, `/runs/${runId}/cancel`)).status).toBe(409)
    s.engine.close()
  })

  it("retries a failed step and its followers", async () => {
    const s = stack("test -f ok.flag")
    const { runId } = await start(s)
    await until(() => types(s, runId).includes("run_failed"))
    const failed = s.engine.fold(runId)!
    expect(failed.status).toBe("failed")
    expect(failed.steps!.steps.c![0]!.status).toBe("failed")
    expect(failed.steps!.steps.o![0]!.status).toBe("skipped")

    // not retryable: a step that did not fail
    expect((await post(s.app, `/runs/${runId}/tasks/t/retry`)).status).toBe(409)

    writeFileSync(join(s.dir, "ok.flag"), "")
    expect((await post(s.app, `/runs/${runId}/tasks/c/retry`)).status).toBe(200)
    await until(() => s.engine.fold(runId)!.status === "succeeded")
    const done = s.engine.fold(runId)!
    expect(done.steps!.steps.c![0]!).toMatchObject({ status: "done", attempts: 2 })
    expect(done.steps!.steps.o![0]!.status).toBe("done")
    s.engine.close()
  })

  it("queues a second start under maxConcurrentRuns and runs it after the first", async () => {
    const s = stack("sleep 0.4")
    const a = await start(s)
    const b = await start(s)
    expect(a.status).toBe("running")
    expect(b.status).toBe("queued")
    expect(s.engine.fold(b.runId)!.status).toBe("queued")
    await until(() => s.engine.fold(b.runId)!.status === "succeeded")
    expect(s.engine.fold(a.runId)!.status).toBe("succeeded")
    s.engine.close()
  })

  it("cancels a queued run", async () => {
    const s = stack("sleep 0.4")
    await start(s)
    const b = await start(s)
    expect((await post(s.app, `/runs/${b.runId}/cancel`)).status).toBe(200)
    expect(s.engine.fold(b.runId)!.status).toBe("cancelled")
    s.engine.close()
  })

  it("pushes step events to a websocket subscriber", async () => {
    const s = stack()
    const hub = new WsHub(s.engine)
    const got: WsServerMessage[] = []
    const ws = { send: (d: string) => got.push(JSON.parse(d)) } as unknown as WSContext
    const events = hub.connection()
    events.onOpen?.(new Event("open"), ws)
    const { runId } = await start(s)
    events.onMessage?.(
      { data: JSON.stringify({ type: "subscribe_run", runId }) } as MessageEvent,
      ws
    )
    await until(() => types(s, runId).includes("run_succeeded"))
    const stepDone = got.filter(
      (m) => m.type === "engine_event" && m.event.type === "step_done"
    )
    expect(stepDone.length).toBe(3)
    expect(got.some((m) => m.type === "run_snapshot")).toBe(true)
    hub.dispose()
    s.engine.close()
  })

  it("resumes a node run left open by a restart", async () => {
    const s = stack("sleep 0.3")
    const { runId } = await start(s)
    await until(() => s.engine.fold(runId)!.steps!.steps.c?.[0]?.current?.pid !== undefined)
    const engine2 = createEngine({ home: s.home })
    const handles = engine2.resumeAll()
    expect(handles.map((h) => h.runId)).toContain(runId)
    await handles.find((h) => h.runId === runId)!.wait()
    expect(engine2.fold(runId)!.status).toBe("succeeded")
    engine2.close()
    s.engine.close()
  })

  it("keeps the task path with the flag off", async () => {
    const s = stack()
    delete process.env.FLOWS_NODES
    const res = await post(s.app, "/workflows/nr/runs")
    expect(res.status).toBe(400)
    s.engine.close()
  })
})

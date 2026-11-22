import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/shared"
import { createEngine } from "./engine.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-input-"))
  homes.push(home)
  return home
}

function graphOf(id: string, run: string, maxConcurrentRuns?: number) {
  return workflowSchema.parse({
    id,
    ...(maxConcurrentRuns !== undefined
      ? { limits: { maxConcurrentRuns } }
      : {}),
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      { id: "a", kind: "command", run },
      { id: "o", kind: "output", target: "folder" },
    ],
    edges: [
      { from: "t", to: "a" },
      { from: "a", to: "o" },
    ],
  })
}

describe("queued runs", () => {
  it("queues a second run when maxConcurrentRuns is omitted (default 1)", async () => {
    const home = tempHome()
    const graph = graphOf("q1", "sleep 0.3 && echo ok")
    const engine = createEngine({ home })
    const first = engine.startNodeRun({ graph, runId: "a" })
    const second = engine.startNodeRun({ graph, runId: "b" })
    expect(first.status).toBe("running")
    expect(second.status).toBe("queued")
    expect(engine.fold("b")?.status).toBe("queued")
    expect(engine.hasLiveRun("q1")).toBe(true)
    await first.wait()
    await second.wait()
    expect(engine.fold("b")?.status).toBe("succeeded")
    expect(engine.events("b").some((e) => e.type === "run_activated")).toBe(
      true
    )
    engine.close()
  })

  it("cancels a queued run and allows delete", async () => {
    const home = tempHome()
    const graph = graphOf("cq", "sleep 5 && echo ok")
    const engine = createEngine({ home })
    const live = engine.startNodeRun({ graph, runId: "live" })
    const queued = engine.startNodeRun({ graph, runId: "wait" })
    expect(queued.status).toBe("queued")
    engine.cancelRun("wait")
    expect(engine.fold("wait")?.status).toBe("cancelled")
    engine.deleteRun("wait")
    expect(engine.fold("wait")?.deleted).toBe(true)
    engine.cancelRun("live")
    await live.wait()
    expect(engine.fold("live")?.status).toBe("cancelled")
    // Let cancel watchers finish before closing the event log.
    await new Promise((r) => setTimeout(r, 50))
    engine.close()
  }, 15_000)

  it("allows two running runs when maxConcurrentRuns is 2", async () => {
    const home = tempHome()
    const graph = graphOf("cap2", "sleep 0.2 && echo ok", 2)
    const engine = createEngine({ home })
    const a = engine.startNodeRun({ graph, runId: "a" })
    const b = engine.startNodeRun({ graph, runId: "b" })
    expect(a.status).toBe("running")
    expect(b.status).toBe("running")
    await Promise.all([a.wait(), b.wait()])
    engine.close()
  })

  it("resumeAll activates a queued run after replay", async () => {
    const home = tempHome()
    const graph = graphOf("resq", "sleep 8 && echo ok")
    const engine = createEngine({ home })
    engine.startNodeRun({ graph, runId: "live" })
    expect(engine.startNodeRun({ graph, runId: "wait" }).status).toBe("queued")
    await new Promise((r) => setTimeout(r, 50))
    engine.close()

    const again = createEngine({ home })
    expect(again.fold("wait")?.status).toBe("queued")
    const handles = again.resumeAll()
    expect(again.fold("live")?.status).toBe("running")
    expect(again.fold("wait")?.status).toBe("queued")
    again.cancelRun("live")
    await handles.find((h) => h.runId === "live")!.wait()
    const waitHandle = again.resumeRun("wait")
    if (waitHandle) await waitHandle.wait()
    expect(again.fold("wait")?.status).toBe("succeeded")
    expect(again.events("wait").some((e) => e.type === "run_activated")).toBe(
      true
    )
    await new Promise((r) => setTimeout(r, 50))
    again.close()
  }, 20_000)
})

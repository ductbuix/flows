import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema, type EngineEvent } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { approveNodeStep, rejectNodeStep } from "./cancel.ts"
import { resumeNodes } from "./drive.ts"
import { foldSteps, latestStep } from "./fold-steps.ts"
import type { ProcessHost } from "./process.ts"
import { CrashError, startNodeRun, tickNodes } from "./tick.ts"

const homes: string[] = []
afterEach(() => {
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

const graph = () =>
  workflowSchema.parse({
    id: "wf",
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      { id: "ok", kind: "approval", question: "Ship it?" },
      { id: "out", kind: "output", target: "folder" },
    ],
    edges: [
      { from: "t", to: "ok" },
      { from: "ok", to: "out" },
    ],
  })

function setup() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-approval-"))
  homes.push(home)
  mkdirSync(workflowDir(home, "wf"), { recursive: true })
  const path = appDbPath(home)
  const open = () => new EventLog(path)
  return { home, open }
}

const eventsOf = (log: EventLog): EngineEvent[] =>
  log.listByRun("r1").map((s) => s.event)

describe("approval node", () => {
  it("waits with the question, and a restart does not ask again", async () => {
    const { home, open } = setup()
    let log = open()
    const state = startNodeRun({
      log,
      home,
      runId: "r1",
      graph: graph(),
      inputText: "the change",
    })
    expect(latestStep(state, "ok")).toMatchObject({
      status: "waiting",
      question: "Ship it?",
    })
    expect(latestStep(state, "out")).toBeUndefined()
    log.close()

    // Restart: a new log and driver find the step still waiting.
    log = open()
    let host: ProcessHost | undefined
    const done = resumeNodes({ log, home, runId: "r1" }, (h) => {
      host = h
    })
    expect(latestStep(foldSteps(eventsOf(log)), "ok")?.status).toBe("waiting")
    expect(eventsOf(log).filter((e) => e.type === "approval_requested")).toHaveLength(1)

    approveNodeStep(log, "r1", "ok")
    host!.wake()
    const end = await done
    expect(end.ended).toBe(true)
    const events = eventsOf(log)
    expect(events.at(-1)?.type).toBe("run_succeeded")
    expect(events.filter((e) => e.type === "approval_requested")).toHaveLength(1)
    expect(latestStep(end, "ok")).toMatchObject({
      status: "done",
      decision: "approved",
    })
    expect(latestStep(end, "out")?.status).toBe("done")
    const root = runDir(workflowDir(home, "wf"), "r1")
    // Approve forwards the input.
    expect(readFileSync(join(root, "nodes/ok/pass-1/text.md"), "utf8")).toContain(
      "the change"
    )
    log.close()
  })

  it("settles an approved step after a crash, without asking again", () => {
    const { home, open } = setup()
    const log = open()
    startNodeRun({ log, home, runId: "r1", graph: graph(), inputText: "x" })
    approveNodeStep(log, "r1", "ok")
    expect(() =>
      tickNodes({
        log,
        home,
        runId: "r1",
        crashAt: (point) => {
          if (point === "after_act") throw new CrashError()
        },
      })
    ).toThrow(CrashError)
    const end = tickNodes({ log, home, runId: "r1" })
    expect(end.ended).toBe(true)
    expect(eventsOf(log).filter((e) => e.type === "approval_requested")).toHaveLength(1)
    expect(latestStep(end, "ok")?.status).toBe("done")
    log.close()
  })

  it("reject ends the run cancelled with reason rejected", () => {
    const { home, open } = setup()
    const log = open()
    startNodeRun({ log, home, runId: "r1", graph: graph(), inputText: "x" })
    rejectNodeStep(log, "r1", "ok")
    const events = eventsOf(log)
    expect(events.at(-1)).toMatchObject({ type: "run_cancelled", reason: "rejected" })
    expect(events.some((e) => e.type === "step_rejected")).toBe(true)
    const steps = foldSteps(events)
    expect(steps.ended).toBe(true)
    expect(latestStep(steps, "ok")).toMatchObject({
      status: "cancelled",
      decision: "rejected",
    })
    expect(latestStep(steps, "out")).toBeUndefined()
    // A decided step cannot be decided again.
    expect(() => approveNodeStep(log, "r1", "ok")).toThrow(/not awaiting approval/)
    log.close()
  })
})

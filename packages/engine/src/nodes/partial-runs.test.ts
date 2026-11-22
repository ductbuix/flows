import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { nodeWorkflowSchema, type EngineEvent } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { foldSteps } from "./fold-steps.ts"
import { startNodeRun } from "./tick.ts"

const homes: string[] = []
afterEach(() => {
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

const graph = nodeWorkflowSchema.parse({
  id: "wf",
  nodes: [
    { id: "t", kind: "trigger", type: "manual" },
    { id: "p", kind: "prompt" },
    { id: "o", kind: "output", target: "folder" },
  ],
  edges: [
    { from: "t", to: "o" },
    { from: "p", to: "o" },
  ],
})

function setup() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-partial-"))
  homes.push(home)
  const nodeDir = join(workflowDir(home, "wf"), "nodes", "p")
  mkdirSync(nodeDir, { recursive: true })
  writeFileSync(join(nodeDir, "text.md"), "house rules")
  const log = new EventLog(appDbPath(home))
  return { home, log }
}

const root = (home: string, runId: string) =>
  runDir(workflowDir(home, "wf"), runId)
const events = (log: EventLog, runId: string): EngineEvent[] =>
  log.listByRun(runId).map((s) => s.event)
const started = (log: EventLog, runId: string) =>
  events(log, runId)
    .filter((e) => e.type === "step_started")
    .map((e) => (e as { nodeId: string }).nodeId)
const reused = (log: EventLog, runId: string) =>
  events(log, runId)
    .filter((e) => e.type === "step_done" && e.reused)
    .map((e) => (e as { nodeId: string }).nodeId)
const read = (home: string, runId: string, rel: string) =>
  readFileSync(join(root(home, runId), rel), "utf8")

function fullRun(home: string, log: EventLog) {
  startNodeRun({ log, home, runId: "r1", graph, inputText: "story" })
}

describe("Run step (only)", () => {
  it("runs one node on the latest upstream results", () => {
    const { home, log } = setup()
    fullRun(home, log)
    // Edits after r1 must not leak into a step run: it reads r1's results.
    writeFileSync(
      join(workflowDir(home, "wf"), "nodes", "p", "text.md"),
      "new rules"
    )
    const state = startNodeRun({
      log,
      home,
      runId: "r2",
      graph,
      partial: { only: "o", bases: ["r1"] },
    })
    expect(state.ended).toBe(true)
    expect(started(log, "r2")).toEqual(["o"])
    expect(reused(log, "r2").sort()).toEqual(["p", "t"])
    expect(events(log, "r2").at(-1)?.type).toBe("run_succeeded")
    expect(events(log, "r2")[0]).toMatchObject({ only: "o" })
    expect(read(home, "r2", "output/p/text.md")).toBe("house rules")
    expect(read(home, "r2", "output/t/text.md")).toBe("story")
    log.close()
  })

  it("takes each input from the newest run that has a result", () => {
    const { home, log } = setup()
    fullRun(home, log)
    startNodeRun({
      log,
      home,
      runId: "r2",
      graph,
      partial: { only: "o", bases: ["r1"] },
    })
    // r3 asks for r2 first, then r1: r2 holds t and p as copied results.
    startNodeRun({
      log,
      home,
      runId: "r3",
      graph,
      partial: { only: "o", bases: ["r2", "r1"] },
    })
    expect(read(home, "r3", "output/t/text.md")).toBe("story")
    log.close()
  })

  it("refuses when an input has no result yet", () => {
    const { home, log } = setup()
    expect(() =>
      startNodeRun({
        log,
        home,
        runId: "r1",
        graph,
        partial: { only: "o", bases: [] },
      })
    ).toThrow(/Run t first/)
    expect(events(log, "r1")).toHaveLength(0)
    log.close()
  })

  it("refuses an unknown node", () => {
    const { home, log } = setup()
    expect(() =>
      startNodeRun({
        log,
        home,
        runId: "r1",
        graph,
        partial: { only: "nope", bases: [] },
      })
    ).toThrow(/Unknown node/)
    log.close()
  })

  it("runs a source node alone", () => {
    const { home, log } = setup()
    fullRun(home, log)
    startNodeRun({
      log,
      home,
      runId: "r2",
      graph,
      partial: { only: "p", bases: ["r1"] },
    })
    expect(started(log, "r2")).toEqual(["p"])
    expect(foldSteps(events(log, "r2")).steps.o).toBeUndefined()
    log.close()
  })
})

describe("Run from here (from)", () => {
  it("reuses unchanged steps before the node", () => {
    const { home, log } = setup()
    fullRun(home, log)
    startNodeRun({
      log,
      home,
      runId: "r2",
      graph,
      partial: { from: "o", bases: ["r1"] },
    })
    expect(started(log, "r2")).toEqual(["o"])
    expect(reused(log, "r2").sort()).toEqual(["p", "t"])
    expect(events(log, "r2")[0]).toMatchObject({ from: "o" })
    // The run input of the base is kept.
    expect(read(home, "r2", "input/text.md")).toBe("story")
    log.close()
  })

  it("runs a step again when its file changed", () => {
    const { home, log } = setup()
    fullRun(home, log)
    writeFileSync(
      join(workflowDir(home, "wf"), "nodes", "p", "text.md"),
      "new rules"
    )
    startNodeRun({
      log,
      home,
      runId: "r2",
      graph,
      partial: { from: "o", bases: ["r1"] },
    })
    expect(started(log, "r2").sort()).toEqual(["o", "p"])
    expect(reused(log, "r2")).toEqual(["t"])
    expect(read(home, "r2", "output/p/text.md")).toBe("new rules")
    log.close()
  })

  it("runs a step again when its settings changed", () => {
    const { home, log } = setup()
    fullRun(home, log)
    const changed = nodeWorkflowSchema.parse({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "p" ? { ...n, name: "Rules" } : n
      ),
    })
    startNodeRun({
      log,
      home,
      runId: "r2",
      graph: changed,
      partial: { from: "o", bases: ["r1"] },
    })
    expect(started(log, "r2").sort()).toEqual(["o", "p"])
    log.close()
  })

  it("runs everything when there is no earlier run", () => {
    const { home, log } = setup()
    startNodeRun({
      log,
      home,
      runId: "r1",
      graph,
      inputText: "story",
      partial: { from: "o", bases: [] },
    })
    expect(started(log, "r1").sort()).toEqual(["o", "p", "t"])
    expect(reused(log, "r1")).toEqual([])
    log.close()
  })

  it("skips a step run as the base: it holds only some nodes", () => {
    const { home, log } = setup()
    fullRun(home, log)
    startNodeRun({
      log,
      home,
      runId: "r2",
      graph,
      partial: { only: "o", bases: ["r1"] },
    })
    startNodeRun({
      log,
      home,
      runId: "r3",
      graph,
      partial: { from: "o", bases: ["r2", "r1"] },
    })
    expect(started(log, "r3")).toEqual(["o"])
    expect(reused(log, "r3").sort()).toEqual(["p", "t"])
    log.close()
  })

  it("runs the node itself and what follows even when unchanged", () => {
    const { home, log } = setup()
    fullRun(home, log)
    startNodeRun({
      log,
      home,
      runId: "r2",
      graph,
      partial: { from: "t", bases: ["r1"] },
    })
    // t and o (after it) run again; p is unchanged and reused.
    expect(started(log, "r2").sort()).toEqual(["o", "t"])
    expect(reused(log, "r2")).toEqual(["p"])
    log.close()
  })
})

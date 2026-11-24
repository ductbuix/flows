import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, workflowDir } from "../paths.ts"
import { foldSteps, latestStep } from "./fold-steps.ts"
import { startNodeRun, tickNodes } from "./tick.ts"

const homes: string[] = []
afterEach(() => {
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

const graph = (title?: string) =>
  workflowSchema.parse({
    id: "wf",
    name: "Nightly",
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      {
        id: "n",
        kind: "output",
        target: "notify",
        ...(title ? { title } : {}),
      },
    ],
    edges: [{ from: "t", to: "n" }],
  })

function setup() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-notify-"))
  homes.push(home)
  mkdirSync(workflowDir(home, "wf"), { recursive: true })
  return { home, log: new EventLog(appDbPath(home)) }
}

describe("output notify", () => {
  it("posts a notice with the title and the input text", () => {
    const { home, log } = setup()
    const state = startNodeRun({
      log,
      home,
      runId: "r1",
      graph: graph("Report ready"),
      inputText: "all green",
    })
    expect(latestStep(state, "n")?.status).toBe("done")
    const { notices, unread } = log.listNotices()
    expect(unread).toBe(1)
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      title: "Report ready",
      runId: "r1",
      workflowId: "wf",
      nodeId: "n",
      read: false,
    })
    expect(notices[0]!.text).toContain("all green")
    log.close()
  })

  it("falls back to the workflow name and posts once per step", () => {
    const { home, log } = setup()
    startNodeRun({ log, home, runId: "r1", graph: graph(), inputText: "hi" })
    expect(log.listNotices().notices[0]!.title).toBe("Nightly")
    // A repeated tick of the same finished run adds nothing.
    tickNodes({ log, home, runId: "r1" })
    expect(log.listNotices().notices).toHaveLength(1)
    log.postNotice({
      key: "r1:n:1",
      title: "dup",
      text: "",
      runId: "r1",
      workflowId: "wf",
      nodeId: "n",
      at: new Date().toISOString(),
    })
    expect(log.listNotices().notices).toHaveLength(1)
    expect(
      foldSteps(log.listByRun("r1").map((s) => s.event)).steps.n
    ).toBeDefined()
    log.close()
  })

  it("marks notices read, one or all", () => {
    const { home, log } = setup()
    startNodeRun({ log, home, runId: "r1", graph: graph("A"), inputText: "x" })
    startNodeRun({ log, home, runId: "r2", graph: graph("B"), inputText: "y" })
    const [b, a] = log.listNotices().notices
    expect(b!.title).toBe("B")
    log.markNoticesRead([a!.id])
    expect(log.listNotices().unread).toBe(1)
    log.markNoticesRead()
    expect(log.listNotices()).toMatchObject({ unread: 0 })
    expect(log.listNotices().notices.every((n) => n.read)).toBe(true)
    log.close()
  })
})

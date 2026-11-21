import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { cursorTrustMarkerPath } from "./cursor-trust.ts"
import { createEngine } from "./engine.ts"
import { EventLog } from "./event-log.ts"
import { appDbPath } from "./paths.ts"

const homes: string[] = []
const prevCursor = process.env.FLOWAPP_CURSOR_PROJECTS
const prevPath = process.env.PATH

afterEach(() => {
  process.env.PATH = prevPath
  if (prevCursor === undefined) delete process.env.FLOWAPP_CURSOR_PROJECTS
  else process.env.FLOWAPP_CURSOR_PROJECTS = prevCursor
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-trust-"))
  homes.push(home)
  process.env.FLOWAPP_CURSOR_PROJECTS = join(home, ".cursor-projects")
  return home
}

function writeAgentWorkflow(home: string, id: string): string {
  const wf = join(home, "workflows", id)
  mkdirSync(join(wf, "tasks", "a"), { recursive: true })
  writeFileSync(join(wf, "tasks", "a", "prompt.md"), "say hi\n")
  writeFileSync(
    join(wf, "workflow.yaml"),
    `
id: ${id}
tasks:
  - id: a
    kind: agent
    cli: claude
`
  )
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
  writeFileSync(join(bin, "agent"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
  return wf
}

describe("trust marker keep and remove", () => {
  it("rejects agent start without a grant", () => {
    const home = tempHome()
    const wf = writeAgentWorkflow(home, "need-trust")
    const engine = createEngine({ home })
    expect(() => engine.startRun({ workflowDir: wf })).toThrow("trust_required")
  })

  it("keeps the marker for a live once-grant and removes after it ends", async () => {
    const home = tempHome()
    const wf = writeAgentWorkflow(home, "once-run")
    const engine = createEngine({ home })
    const handle = engine.startRun({
      workflowDir: wf,
      runId: "r1",
      trustGrant: "once",
    })
    const marker = cursorTrustMarkerPath(
      engine.homeRealpath(),
      process.env.FLOWAPP_CURSOR_PROJECTS
    )
    expect(existsSync(marker)).toBe(true)
    expect(engine.fold("r1")?.trustGrant).toBe("once")
    await handle.wait()
    expect(existsSync(marker)).toBe(false)
    engine.close()
  })

  it("keeps the marker while always-trust is valid", async () => {
    const home = tempHome()
    const wf = writeAgentWorkflow(home, "always-run")
    const engine = createEngine({ home })
    engine.setAlwaysTrust()
    const marker = cursorTrustMarkerPath(
      engine.homeRealpath(),
      process.env.FLOWAPP_CURSOR_PROJECTS
    )
    expect(existsSync(marker)).toBe(true)
    await engine
      .startRun({ workflowDir: wf, runId: "r1", trustGrant: "always" })
      .wait()
    expect(existsSync(marker)).toBe(true)
    engine.revokeAlwaysTrust()
    expect(existsSync(marker)).toBe(false)
    engine.close()
  })

  it("asks again when the home realpath binding changes", async () => {
    const home = tempHome()
    writeAgentWorkflow(home, "bind")
    const engine = createEngine({ home })
    engine.setAlwaysTrust()
    expect(engine.trustDecision()).toBe("always")
    engine.close()

    const log = new EventLog(appDbPath(home))
    log.setCliTrust({
      homeRealpath: "/some/other/path",
      trustedAt: new Date().toISOString(),
    })
    log.close()

    const again = createEngine({ home })
    expect(again.trustDecision()).toBe("none")
    again.close()
  })

  it("keeps the marker across concurrent once-grants", async () => {
    const home = tempHome()
    const wf = writeAgentWorkflow(home, "concurrent")
    const sleepBin = join(home, "bin", "claude")
    writeFileSync(sleepBin, "#!/bin/sh\nsleep 0.4\nexit 0\n", { mode: 0o755 })
    const engine = createEngine({ home })
    const a = engine.startRun({
      workflowDir: wf,
      runId: "a",
      trustGrant: "once",
    })
    writeFileSync(sleepBin, "#!/bin/sh\nsleep 1.2\nexit 0\n", { mode: 0o755 })
    const b = engine.startRun({
      workflowDir: wf,
      runId: "b",
      trustGrant: "once",
    })
    const marker = cursorTrustMarkerPath(
      engine.homeRealpath(),
      process.env.FLOWAPP_CURSOR_PROJECTS
    )
    expect(existsSync(marker)).toBe(true)
    await a.wait()
    expect(engine.fold("b")?.status).toBe("running")
    expect(existsSync(marker)).toBe(true)
    await b.wait()
    expect(existsSync(marker)).toBe(false)
    engine.close()
  })
})

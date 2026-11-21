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
import { afterEach, describe, expect, it } from "vitest"
import {
  cursorTrustMarkerPath,
  pathComponentCount,
  readCursorTrustMarker,
} from "./cursor-trust.ts"
import { createEngine } from "./engine.ts"

/**
 * Live Cursor agent under sandbox (BL-018). Skipped unless
 * FLOWAPP_LIVE_CURSOR=1 so default CI stays offline-friendly.
 */
const live = process.env.FLOWAPP_LIVE_CURSOR === "1"

const homes: string[] = []
const prevCursor = process.env.FLOWAPP_CURSOR_PROJECTS
const prevSandbox = process.env.FLOWAPP_SANDBOX

afterEach(() => {
  if (prevCursor === undefined) delete process.env.FLOWAPP_CURSOR_PROJECTS
  else process.env.FLOWAPP_CURSOR_PROJECTS = prevCursor
  if (prevSandbox === undefined) delete process.env.FLOWAPP_SANDBOX
  else process.env.FLOWAPP_SANDBOX = prevSandbox
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

describe.skipIf(!live)("live Cursor trust marker under sandbox", () => {
  it("runs a Cursor agent sandboxed with pre-written markers", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-live-"))
    homes.push(home)
    delete process.env.FLOWAPP_CURSOR_PROJECTS
    delete process.env.FLOWAPP_SANDBOX

    const wf = join(home, "workflows", "live-trust")
    mkdirSync(join(wf, "tasks", "hello"), { recursive: true })
    writeFileSync(
      join(wf, "tasks", "hello", "prompt.md"),
      "Write the text ok into out/done.txt and stop. Do not ask questions.\n"
    )
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: live-trust
timeout: 120
tasks:
  - id: hello
    kind: agent
    cli: cursor
    timeout: 120
`
    )

    const engine = createEngine({ home })
    const homeReal = engine.homeRealpath()
    expect(pathComponentCount(homeReal)).toBeGreaterThanOrEqual(3)

    const handle = await engine.startRun({
      workflowDir: wf,
      runId: "live1",
      trustGrant: "once",
    })
    expect(existsSync(cursorTrustMarkerPath(home))).toBe(true)
    expect(readCursorTrustMarker(home)?.workspacePath).toBeTruthy()

    const state = await handle.wait()
    const stderr = readFileSync(
      join(wf, "runs", "live1", "tasks", "hello", "attempt-1", "stderr.log"),
      "utf8"
    )
    expect(state.sandboxed).toBe(true)
    expect(stderr).not.toMatch(
      /Failed to create trust marker|Failed to trust workspace|Workspace Trust Required/
    )
    expect(state.tasks.hello?.status).toBe("succeeded")
    engine.close()
  }, 180_000)
})

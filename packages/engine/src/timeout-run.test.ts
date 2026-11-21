import { spawn } from "node:child_process"
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
import { createEngine } from "./engine.ts"
import { EventLog } from "./event-log.ts"
import { appDbPath } from "./paths.ts"
import { isPidAlive } from "./pid.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-timeout-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, id: string, yaml: string): string {
  const workflowDir = join(home, "workflows", id)
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), yaml)
  return workflowDir
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

describe("attempt timeout", () => {
  it("kills the process group and fails with reason timeout", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "to",
      `
id: to
tasks:
  - id: slow
    kind: command
    timeout: 1
    run: "printf x > \\"$WF_DIR/started.txt\\" && sleep 30"
`
    )
    const started = join(workflowDir, "started.txt")
    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir, runId: "t1" })

    await waitFor(() => existsSync(started))
    await waitFor(() => handle.state().tasks.slow?.status === "running")
    const pid = handle.state().tasks.slow?.attempts[0]?.pid
    expect(pid).toBeDefined()

    const launched = engine
      .events("t1")
      .find((e) => e.type === "attempt_launched")
    expect(launched).toMatchObject({
      type: "attempt_launched",
      timeout: 1,
    })

    const state = await handle.wait()
    expect(state.status).toBe("failed")
    expect(state.tasks.slow?.status).toBe("failed")
    expect(state.tasks.slow?.attempts[0]?.reason).toBe("timeout")
    await waitFor(() => !isPidAlive(pid!))
    engine.close()
  }, 20_000)

  it("retries after a timeout like any failure", async () => {
    const prev = process.env.FLOWAPP_RETRY_BACKOFF_MS
    process.env.FLOWAPP_RETRY_BACKOFF_MS = "50"
    try {
      const home = tempHome()
      writeWorkflow(
        home,
        "to-retry",
        `
id: to-retry
tasks:
  - id: flaky
    kind: command
    timeout: 1
    retry: { max: 2 }
    run: "sleep 30"
`
      )
      const engine = createEngine({ home })
      const handle = engine.startRun({
        workflowDir: join(home, "workflows", "to-retry"),
        runId: "t2",
      })
      const state = await handle.wait()
      expect(state.status).toBe("failed")
      expect(state.tasks.flaky?.attempts.length).toBe(2)
      expect(
        state.tasks.flaky?.attempts.every((a) => a.reason === "timeout")
      ).toBe(true)
      engine.close()
    } finally {
      if (prev === undefined) delete process.env.FLOWAPP_RETRY_BACKOFF_MS
      else process.env.FLOWAPP_RETRY_BACKOFF_MS = prev
    }
  }, 30_000)

  it("enforces remaining time on resume", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "to-resume",
      `
id: to-resume
tasks:
  - id: slow
    kind: command
    timeout: 1
    run: "sleep 60"
`
    )
    const child = spawn("/bin/sh", ["-c", "sleep 60"], {
      detached: true,
      stdio: "ignore",
    })
    child.unref()
    const pid = child.pid!
    expect(isPidAlive(pid)).toBe(true)

    const startedAt = new Date(Date.now() - 5_000).toISOString()
    const log = new EventLog(appDbPath(home))
    const graph = {
      id: "to-resume",
      tasks: [
        {
          id: "slow",
          kind: "command" as const,
          run: "sleep 60",
          timeout: 1,
          needs: [] as string[],
        },
      ],
    }
    log.append({
      type: "run_started",
      runId: "t3",
      workflowId: "to-resume",
      graph,
      at: startedAt,
    })
    log.append({
      type: "attempt_started",
      runId: "t3",
      taskId: "slow",
      attempt: 1,
      at: startedAt,
    })
    log.append({
      type: "attempt_launched",
      runId: "t3",
      taskId: "slow",
      attempt: 1,
      pid,
      timeout: 1,
      sandboxed: true,
      at: startedAt,
    })
    log.close()

    mkdirSync(join(workflowDir, "runs", "t3", "tasks", "slow", "attempt-1"), {
      recursive: true,
    })

    const engine = createEngine({ home })
    const resumed = engine.resumeRun("t3")
    expect(resumed).not.toBeNull()
    const state = await resumed!.wait()
    expect(state.tasks.slow?.status).toBe("failed")
    expect(state.tasks.slow?.attempts[0]?.reason).toBe("timeout")
    await waitFor(() => !isPidAlive(pid))
    engine.close()
  }, 20_000)
})

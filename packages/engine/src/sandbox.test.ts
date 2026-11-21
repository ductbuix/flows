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
import { createEngine } from "./engine.ts"
import { loadWorkflowFile } from "./workflow.ts"
import { resolveAppHomeRealpath } from "./paths.ts"
import { runPreflightChecks } from "./preflight.ts"
import { cookiesPath, writeCookies } from "./secrets.ts"
import {
  buildSandboxSpawn,
  canApplySandbox,
  sandboxSecretsRoot,
  sandboxWriteRoot,
} from "./sandbox.ts"

const homes: string[] = []
const engines: Array<{ close: () => void }> = []

afterEach(() => {
  delete process.env.FLOWAPP_SANDBOX
  for (const engine of engines.splice(0)) {
    engine.close()
  }
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-sandbox-"))
  homes.push(home)
  return home
}

describe("sandbox helpers", () => {
  it("respects FLOWAPP_SANDBOX=0 fallback", () => {
    process.env.FLOWAPP_SANDBOX = "0"
    expect(canApplySandbox()).toBe(false)
    const spawn = buildSandboxSpawn("echo hi", tempHome())
    expect(spawn.sandboxed).toBe(false)
    expect(spawn.command).toBe("/bin/sh")
  })

  it("wraps with sandbox-exec on macOS when enabled", () => {
    if (process.platform !== "darwin") return
    const home = tempHome()
    const spawn = buildSandboxSpawn("echo hi", home)
    expect(spawn.sandboxed).toBe(true)
    if (spawn.sandboxed) {
      expect(spawn.command).toBe("/usr/bin/sandbox-exec")
      expect(spawn.args).toContain(`WF_DIR=${sandboxWriteRoot(home)}`)
    }
  })
})

describe("sandbox write boundary", () => {
  it("allows writes inside the workflow dir and blocks outside", async () => {
    if (!canApplySandbox()) return

    const home = tempHome()
    const wf = join(home, "workflows", "sandbox-boundary")
    const outside = join(home, "outside")
    mkdirSync(wf, { recursive: true })
    mkdirSync(outside, { recursive: true })
    const outsideFile = join(outside, "bad.txt")
    writeFileSync(
      join(wf, "workflow.yaml"),
      [
        "id: sandbox-boundary",
        "tasks:",
        "  - id: inside",
        "    kind: command",
        '    run: "printf ok > \\"$TASK_OUT/ok.txt\\""',
        "  - id: outside",
        "    kind: command",
        `    run: "printf bad > '${outsideFile.replaceAll("'", "'\\''")}'"`,
        "    needs: [inside]",
        "    continueOnError: true",
        "",
      ].join("\n")
    )

    const engine = createEngine({ home })
    engines.push(engine)
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()

    expect(state.status).toBe("succeeded")
    expect(state.tasks.inside?.status).toBe("succeeded")
    expect(state.tasks.outside?.status).toBe("failed")
    expect(state.sandboxed).toBe(true)

    expect(
      readFileSync(
        join(wf, "runs", "r1", "tasks", "inside", "latest", "out", "ok.txt"),
        "utf8"
      )
    ).toBe("ok")
    expect(() => readFileSync(outsideFile)).toThrow()

    const launched = engine
      .events("r1")
      .filter((e) => e.type === "attempt_launched")
    expect(launched.every((e) => e.sandboxed === true)).toBe(true)
  })

  it("marks the run unsandboxed when sandbox is forced off", async () => {
    process.env.FLOWAPP_SANDBOX = "0"
    const home = tempHome()
    const wf = join(home, "workflows", "no-sandbox")
    mkdirSync(wf, { recursive: true })
    writeFileSync(
      join(wf, "workflow.yaml"),
      [
        "id: no-sandbox",
        "tasks:",
        "  - id: a",
        "    kind: command",
        '    run: "printf x > \\"$TASK_OUT/x.txt\\""',
        "",
      ].join("\n")
    )

    const engine = createEngine({ home })
    engines.push(engine)
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()

    expect(state.status).toBe("succeeded")
    expect(state.sandboxed).toBe(false)

    const checks = await runPreflightChecks({
      homeRealpath: resolveAppHomeRealpath(home),
      home,
      workflowDir: wf,
      workflow: loadWorkflowFile(wf),
    })
    const sandbox = checks.find((c) => c.id === "sandbox")
    expect(sandbox?.status).toBe("warn")
    expect(sandbox?.message).toMatch(/secrets\/ protection is off/)
  })

  it("denies sandboxed tasks from reading secrets/cookies.json", async () => {
    if (!canApplySandbox()) return

    const home = tempHome()
    writeCookies(home, "rally-payments", [
      {
        name: "sid",
        value: "sandbox-secret-cookie",
        domain: "example.com",
        path: "/",
      },
    ])
    const cookieFile = cookiesPath(home, "rally-payments")
    const wf = join(home, "workflows", "secrets-deny")
    mkdirSync(wf, { recursive: true })
    const escaped = cookieFile.replaceAll("'", "'\\''")
    writeFileSync(
      join(wf, "workflow.yaml"),
      [
        "id: secrets-deny",
        "tasks:",
        "  - id: read-secret",
        "    kind: command",
        `    run: "cat '${escaped}' > \\"$TASK_OUT/leak.txt\\""`,
        "    continueOnError: true",
        "",
      ].join("\n")
    )

    const engine = createEngine({ home })
    engines.push(engine)
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()

    expect(state.status).toBe("succeeded")
    expect(state.tasks["read-secret"]?.status).toBe("failed")
    expect(state.sandboxed).toBe(true)
    const leakPath = join(
      wf,
      "runs",
      "r1",
      "tasks",
      "read-secret",
      "latest",
      "out",
      "leak.txt"
    )
    // Redirect may create an empty file before cat is denied.
    if (existsSync(leakPath)) {
      expect(readFileSync(leakPath, "utf8")).not.toContain(
        "sandbox-secret-cookie"
      )
    }
    const stderr = readFileSync(
      join(wf, "runs", "r1", "tasks", "read-secret", "attempt-1", "stderr.log"),
      "utf8"
    )
    expect(stderr).toMatch(/Operation not permitted|Permission denied/)

    const spawn = buildSandboxSpawn("true", wf)
    expect(spawn.sandboxed).toBe(true)
    if (spawn.sandboxed) {
      expect(spawn.args).toContain(`SECRETS_DIR=${sandboxSecretsRoot(wf)}`)
    }
  })
})
